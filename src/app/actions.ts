"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb, schema } from "@/lib/db";
import { resolvePlayer, type Player } from "@/lib/mojang";
import { notifyOrderPaid } from "@/lib/notify";
import { createPreference, isMercadoPagoConfigured } from "@/lib/mercadopago";
import { toMajor } from "@/lib/money";
import { markOrderPaid, priceCart, reserveGiftCard } from "@/lib/orders";
import { rateLimitByIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/url";

const checkoutSchema = z.object({
  player: z.string().min(2).max(17),
  recipient: z.string().max(17).optional().nullable(),
  email: z.union([z.email().max(200), z.literal("")]).optional(),
  coupon: z.string().max(64).optional().nullable(),
  giftCard: z.string().max(64).optional().nullable(),
  provider: z.enum(["stripe", "mercadopago"]).optional(),
  lines: z.array(z.object({ productId: z.number().int(), quantity: z.number().int().min(1).max(999) })).min(1).max(50),
});

export type CheckoutResult = { url: string } | { error: string };

class CheckoutError extends Error {}

/**
 * Creates the order and sends the buyer to Stripe. Carts fully covered by coupons or gift cards skip Stripe,
 * subscriptions always go through it.
 */
export async function checkout(input: z.input<typeof checkoutSchema>): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_request" };
  if (!(await rateLimitByIp("checkout", 10, 60)).allowed) return { error: "rate_limited" };
  const { lines, coupon, email, giftCard } = parsed.data;

  const settings = await getSettings();
  const allowed = (player: Player | null): player is Player =>
    player !== null && (!settings.requirePremium || player.premium || player.name.startsWith("."));
  const buyer = await resolvePlayer(parsed.data.player);
  if (!allowed(buyer)) return { error: "invalid_player" };
  const recipientName = parsed.data.recipient?.trim();
  const recipient = recipientName ? await resolvePlayer(recipientName) : null;
  if (recipientName && !allowed(recipient)) return { error: "invalid_recipient" };
  const target = recipient ?? buyer;
  const giftFrom = recipient && recipient.name.toLowerCase() !== buyer.name.toLowerCase() ? buyer.name : null;

  const currency = settings.currency.toUpperCase();
  const cart = await priceCart(lines, coupon, giftCard, currency);
  if (cart.lines.length === 0) return { error: "empty_cart" };
  if (cart.couponError) return { error: `coupon_${cart.couponError}` };
  if (cart.cartError) return { error: cart.cartError };
  if (cart.giftCardError) return { error: `giftcard_${cart.giftCardError}` };
  const subscription = cart.subscription;
  const provider =
    parsed.data.provider === "mercadopago" && isMercadoPagoConfigured()
      ? "mercadopago"
      : isStripeConfigured()
        ? "stripe"
        : isMercadoPagoConfigured()
          ? "mercadopago"
          : null;
  if (subscription && provider === "mercadopago") return { error: "mercadopago_subscription" };
  if ((cart.due > 0 || subscription) && !provider) return { error: "payments_disabled" };

  let order: typeof schema.orders.$inferSelect;
  try {
    order = await getDb().transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.orders)
        .values({
          playerName: target.name,
          playerUuid: target.uuid,
          giftFrom,
          email: email || null,
          currency,
          subtotal: cart.subtotal,
          discount: cart.discount,
          total: cart.total,
          giftCardAmount: cart.giftCardAmount,
          couponCode: cart.coupon?.code ?? null,
          paymentProvider: cart.due > 0 || subscription ? provider : null,
        })
        .returning();
      await tx.insert(schema.orderItems).values(
        cart.lines.map((line) => ({
          orderId: created.id,
          productId: line.product.id,
          name: line.product.name,
          kind: line.product.kind,
          group: line.product.group,
          itemId: line.product.itemId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.paid,
        })),
      );
      if (cart.giftCard && !(await reserveGiftCard(tx, cart.giftCard.id, created.id, cart.giftCardAmount))) {
        throw new CheckoutError("giftcard_empty");
      }
      return created;
    });
  } catch (error) {
    if (error instanceof CheckoutError) return { error: error.message };
    throw error;
  }

  const baseUrl = await getBaseUrl();

  if (cart.due === 0 && !subscription) {
    if (await markOrderPaid(order.id)) after(() => notifyOrderPaid(order.id, baseUrl));
    return { url: `${baseUrl}/checkout/success?order=${order.id}` };
  }

  if (provider === "mercadopago") {
    const reduced = cart.discount + cart.giftCardAmount > 0;
    const preference = await createPreference({
      orderId: order.id,
      currency,
      email: email || null,
      baseUrl,
      successUrl: `${baseUrl}/checkout/success?order=${order.id}`,
      items: reduced
        ? [{ id: `order-${order.id}`, title: `${settings.storeName} #${order.id}`, quantity: 1, unitPrice: toMajor(cart.due, currency) }]
        : cart.lines.map((line) => ({
            id: line.product.slug,
            title: line.product.name,
            description: line.product.tagline || undefined,
            quantity: line.quantity,
            unitPrice: toMajor(line.unitPrice, currency),
            pictureUrl: line.product.image?.startsWith("https://") ? line.product.image : undefined,
          })),
    });
    await getDb().update(schema.orders).set({ mpPreferenceId: preference.id }).where(eq(schema.orders.id, order.id));
    return { url: preference.url };
  }

  const stripe = getStripe();
  const lower = currency.toLowerCase();
  const reduction = cart.discount + cart.giftCardAmount;
  const discounts = reduction
    ? [
        {
          coupon: (
            await stripe.coupons.create({
              amount_off: reduction,
              currency: lower,
              duration: "once",
              max_redemptions: 1,
              name: [cart.coupon?.code, cart.giftCardAmount ? "Gift card" : null].filter(Boolean).join(" + ") || "Discount",
            })
          ).id,
        },
      ]
    : undefined;

  const metadata = { orderId: String(order.id), player: target.name };
  const session = await stripe.checkout.sessions.create({
    mode: subscription ? "subscription" : "payment",
    client_reference_id: String(order.id),
    metadata,
    customer_email: email || undefined,
    line_items: cart.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: lower,
        unit_amount: line.unitPrice,
        recurring: line.product.kind === "subscription" ? { interval: line.product.interval ?? "month" } : undefined,
        product_data: {
          name: line.product.name,
          description: line.product.tagline || undefined,
          images: line.product.image?.startsWith("https://") ? [line.product.image] : undefined,
          metadata: { itemId: line.product.itemId, group: line.product.group },
        },
      },
    })),
    discounts,
    ...(subscription ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
    success_url: `${baseUrl}/checkout/success?order=${order.id}&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout/cancel`,
  });

  await getDb().update(schema.orders).set({ stripeSessionId: session.id }).where(eq(schema.orders.id, order.id));

  if (!session.url) return { error: "stripe_error" };
  return { url: session.url };
}
