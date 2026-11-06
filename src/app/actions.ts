"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb, schema } from "@/lib/db";
import { resolvePlayer, type Player } from "@/lib/mojang";
import { notifyOrderPaid } from "@/lib/notify";
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
  if ((cart.due > 0 || subscription) && !isStripeConfigured()) return { error: "payments_disabled" };

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
