"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { resolvePlayer } from "@/lib/mojang";
import { allocateDiscount, markOrderPaid, priceCart } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/url";

const checkoutSchema = z.object({
  player: z.string().min(2).max(17),
  email: z.union([z.email().max(200), z.literal("")]).optional(),
  coupon: z.string().max(64).optional().nullable(),
  lines: z.array(z.object({ productId: z.number().int(), quantity: z.number().int().min(1).max(999) })).min(1).max(50),
});

export type CheckoutResult = { url: string } | { error: string };

/**
 * Creates the order and sends the buyer to Stripe. Free carts (100% coupon) skip Stripe.
 */
export async function checkout(input: z.input<typeof checkoutSchema>): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_request" };
  const { lines, coupon, email } = parsed.data;

  const settings = await getSettings();
  const player = await resolvePlayer(parsed.data.player);
  if (!player) return { error: "invalid_player" };
  if (settings.requirePremium && !player.premium && !player.name.startsWith(".")) return { error: "invalid_player" };

  const cart = await priceCart(lines, coupon);
  if (cart.lines.length === 0) return { error: "empty_cart" };
  if (cart.couponError) return { error: `coupon_${cart.couponError}` };
  if (cart.total > 0 && !isStripeConfigured()) return { error: "payments_disabled" };

  const currency = settings.currency.toUpperCase();
  const paidPerLine = allocateDiscount(cart.lines, cart.discount, cart.subtotal);

  const order = await getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.orders)
      .values({
        playerName: player.name,
        playerUuid: player.uuid,
        email: email || null,
        currency,
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total,
        couponCode: cart.coupon?.code ?? null,
      })
      .returning();
    await tx.insert(schema.orderItems).values(
      cart.lines.map((line, index) => ({
        orderId: created.id,
        productId: line.product.id,
        name: line.product.name,
        group: line.product.group,
        itemId: line.product.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: paidPerLine[index],
      })),
    );
    return created;
  });

  const baseUrl = await getBaseUrl();

  if (cart.total === 0) {
    await markOrderPaid(order.id);
    return { url: `${baseUrl}/checkout/success?order=${order.id}` };
  }

  const stripe = getStripe();
  const discounts = cart.discount
    ? [
        {
          coupon: (
            await stripe.coupons.create({
              amount_off: cart.discount,
              currency: currency.toLowerCase(),
              duration: "once",
              max_redemptions: 1,
              name: cart.coupon?.code ?? "Discount",
            })
          ).id,
        },
      ]
    : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: String(order.id),
    metadata: { orderId: String(order.id), player: player.name },
    customer_email: email || undefined,
    line_items: cart.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: line.unitPrice,
        product_data: {
          name: line.product.name,
          description: line.product.tagline || undefined,
          images: line.product.image?.startsWith("https://") ? [line.product.image] : undefined,
          metadata: { itemId: line.product.itemId, group: line.product.group },
        },
      },
    })),
    discounts,
    payment_intent_data: { metadata: { orderId: String(order.id), player: player.name } },
    success_url: `${baseUrl}/checkout/success?order=${order.id}`,
    cancel_url: `${baseUrl}/checkout/cancel`,
  });

  await getDb()
    .update(schema.orders)
    .set({ stripeSessionId: session.id })
    .where(eq(schema.orders.id, order.id));

  if (!session.url) return { error: "stripe_error" };
  return { url: session.url };
}
