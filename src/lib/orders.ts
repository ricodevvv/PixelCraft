import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, gte, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { Coupon, GiftCard, Product } from "./db/schema";
import { withSales } from "./sales";

export type CartLine = { productId: number; quantity: number };

export type PricedLine = {
  product: Product;
  quantity: number;
  unitPrice: number;
  total: number;
  paid: number;
};

export type CartProblem = "subscription_alone" | "giftcard_on_subscription";

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  total: number;
  giftCardAmount: number;
  due: number;
  coupon: Coupon | null;
  couponError: string | null;
  giftCard: GiftCard | null;
  giftCardError: string | null;
  cartError: CartProblem | null;
  subscription: PricedLine | null;
};

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export function couponProblem(coupon: Coupon | undefined | null): string | null {
  if (!coupon || !coupon.active) return "invalid";
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) return "expired";
  if (coupon.maxUses !== null && coupon.uses >= coupon.maxUses) return "used";
  return null;
}

function discountFor(coupon: Coupon, subtotal: number): number {
  const raw = coupon.type === "percent" ? Math.round((subtotal * Math.min(coupon.value, 100)) / 100) : coupon.value;
  return Math.max(0, Math.min(raw, subtotal));
}

/**
 * Spreads a discount over lines in proportion to their totals, so the plugin sees what was really paid per item.
 */
function spread(totals: number[], discount: number): number[] {
  const sum = totals.reduce((acc, value) => acc + value, 0);
  if (discount <= 0 || sum <= 0) return totals;
  let remaining = discount;
  return totals.map((total, index) => {
    const share = index === totals.length - 1 ? remaining : Math.round((discount * total) / sum);
    remaining -= share;
    return total - share;
  });
}

export function normalizeGiftCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Prices a cart with fresh product data from the database. Never trust prices from the browser.
 * Coupons skip gift cards, and gift card balance pays for everything except other gift cards.
 */
export async function priceCart(
  input: CartLine[],
  couponCode?: string | null,
  giftCode?: string | null,
  currency?: string,
): Promise<PricedCart> {
  const db = getDb();
  const merged = new Map<number, number>();
  for (const line of input) {
    if (!Number.isInteger(line.productId) || !Number.isInteger(line.quantity) || line.quantity < 1) continue;
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity);
  }

  const ids = [...merged.keys()];
  const rows = ids.length
    ? await db
        .select()
        .from(schema.products)
        .where(and(inArray(schema.products.id, ids), eq(schema.products.active, true)))
    : [];

  const base = (await withSales(rows)).map((product) => {
    const cap = product.kind === "subscription" ? 1 : Math.max(1, product.maxQuantity);
    const quantity = Math.min(merged.get(product.id) ?? 1, cap);
    return { product, quantity, unitPrice: product.price, total: product.price * quantity };
  });
  const subtotal = base.reduce((sum, line) => sum + line.total, 0);

  const subscriptionLines = base.filter((line) => line.product.kind === "subscription");
  let cartError: CartProblem | null = null;
  if (subscriptionLines.length > 0 && base.length > 1) cartError = "subscription_alone";

  let coupon: Coupon | null = null;
  let couponError: string | null = null;
  if (couponCode?.trim()) {
    const [found] = await db
      .select()
      .from(schema.coupons)
      .where(eq(schema.coupons.code, couponCode.trim().toUpperCase()))
      .limit(1);
    couponError = couponProblem(found);
    if (!couponError) coupon = found;
  }

  const eligible = base.filter((line) => line.product.kind !== "giftcard");
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.total, 0);
  const discount = coupon ? discountFor(coupon, eligibleSubtotal) : 0;
  const paidEligible = spread(
    eligible.map((line) => line.total),
    discount,
  );
  const lines: PricedLine[] = base.map((line) => {
    const index = eligible.indexOf(line);
    return { ...line, paid: index === -1 ? line.total : paidEligible[index] };
  });
  const total = subtotal - discount;

  let giftCard: GiftCard | null = null;
  let giftCardError: string | null = null;
  let giftCardAmount = 0;
  if (giftCode?.trim()) {
    const [found] = await db
      .select()
      .from(schema.giftCards)
      .where(eq(schema.giftCards.code, normalizeGiftCode(giftCode)))
      .limit(1);
    if (!found || !found.active) giftCardError = "invalid";
    else if (found.balance <= 0) giftCardError = "empty";
    else if (currency && found.currency !== currency.toUpperCase()) giftCardError = "invalid";
    else if (subscriptionLines.length > 0) {
      giftCardError = "subscription";
      cartError ??= "giftcard_on_subscription";
    } else {
      giftCard = found;
      const payable = lines.filter((line) => line.product.kind !== "giftcard").reduce((sum, line) => sum + line.paid, 0);
      giftCardAmount = Math.min(found.balance, payable);
    }
  }

  return {
    lines,
    subtotal,
    discount,
    total,
    giftCardAmount,
    due: total - giftCardAmount,
    coupon,
    couponError,
    giftCard,
    giftCardError,
    cartError,
    subscription: subscriptionLines.length === 1 ? lines.find((line) => line.product.kind === "subscription")! : null,
  };
}

/**
 * Takes the balance off a gift card for an order. Fails if someone spent it in the meantime.
 */
export async function reserveGiftCard(tx: Tx, giftCardId: number, orderId: number, amount: number): Promise<boolean> {
  if (amount <= 0) return true;
  const updated = await tx
    .update(schema.giftCards)
    .set({ balance: sql`${schema.giftCards.balance} - ${amount}` })
    .where(and(eq(schema.giftCards.id, giftCardId), eq(schema.giftCards.active, true), gte(schema.giftCards.balance, amount)))
    .returning({ id: schema.giftCards.id });
  if (updated.length === 0) return false;
  await tx.insert(schema.giftCardRedemptions).values({ giftCardId, orderId, amount });
  return true;
}

async function restoreGiftCards(tx: Tx, orderId: number) {
  const redemptions = await tx
    .update(schema.giftCardRedemptions)
    .set({ restoredAt: new Date() })
    .where(and(eq(schema.giftCardRedemptions.orderId, orderId), isNull(schema.giftCardRedemptions.restoredAt)))
    .returning();
  for (const redemption of redemptions) {
    await tx
      .update(schema.giftCards)
      .set({ balance: sql`${schema.giftCards.balance} + ${redemption.amount}` })
      .where(eq(schema.giftCards.id, redemption.giftCardId));
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newGiftCode(): string {
  const chunk = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `PX-${chunk()}-${chunk()}-${chunk()}`;
}

async function issueGiftCards(tx: Tx, orderId: number, currency: string) {
  const items = await tx
    .select()
    .from(schema.orderItems)
    .where(and(eq(schema.orderItems.orderId, orderId), eq(schema.orderItems.kind, "giftcard")));
  const cards = items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      code: newGiftCode(),
      initialBalance: item.unitPrice,
      balance: item.unitPrice,
      currency,
      orderId,
    })),
  );
  if (cards.length > 0) await tx.insert(schema.giftCards).values(cards);
}

async function queueDeliveries(tx: Tx, orderId: number, execution: "BUY" | "RECOVER" | "REFUND", groups?: string[]) {
  const targets =
    groups ??
    (
      await tx
        .selectDistinct({ group: schema.orderItems.group })
        .from(schema.orderItems)
        .where(and(eq(schema.orderItems.orderId, orderId), ne(schema.orderItems.kind, "giftcard")))
    ).map((row) => row.group);
  if (targets.length === 0) return;
  await tx.insert(schema.deliveries).values(targets.map((group) => ({ orderId, group, execution })));
}

/**
 * Takes back what an order gave: drops deliveries that never reached the server,
 * and queues a REFUND for groups that already got the items so the plugin runs onRefund.
 */
async function revokeDeliveries(tx: Tx, orderId: number) {
  await tx.delete(schema.deliveries).where(and(eq(schema.deliveries.orderId, orderId), isNull(schema.deliveries.deliveredAt)));
  const delivered = await tx
    .selectDistinct({ group: schema.deliveries.group })
    .from(schema.deliveries)
    .where(
      and(eq(schema.deliveries.orderId, orderId), eq(schema.deliveries.execution, "BUY"), isNotNull(schema.deliveries.deliveredAt)),
    );
  await queueDeliveries(
    tx,
    orderId,
    "REFUND",
    delivered.map((row) => row.group),
  );
}

type PaidExtras = { paymentIntent?: string | null; email?: string | null; subscriptionId?: string | null };

/**
 * Flips a pending order to paid, queues it for every server group in it and issues its gift cards.
 * Safe to call twice (webhook retries), only the first call does anything.
 */
export async function markOrderPaid(orderId: number, extras: PaidExtras = {}): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .update(schema.orders)
      .set({
        status: "paid",
        paidAt: new Date(),
        stripePaymentIntent: extras.paymentIntent ?? null,
        stripeSubscriptionId: extras.subscriptionId ?? null,
        email: extras.email ? sql`coalesce(${schema.orders.email}, ${extras.email})` : undefined,
      })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "pending")))
      .returning();
    if (!order) return false;

    await queueDeliveries(tx, orderId, "BUY");
    await issueGiftCards(tx, orderId, order.currency);
    if (order.couponCode) {
      await tx
        .update(schema.coupons)
        .set({ uses: sql`${schema.coupons.uses} + 1` })
        .where(eq(schema.coupons.code, order.couponCode));
    }
    return true;
  });
}

/**
 * Cancels a pending order and gives back any gift card balance it had reserved.
 */
export async function cancelOrder(orderId: number): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .update(schema.orders)
      .set({ status: "cancelled" })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "pending")))
      .returning({ id: schema.orders.id });
    if (rows.length === 0) return false;
    await restoreGiftCards(tx, orderId);
    return true;
  });
}

/**
 * Marks a paid order as refunded: revokes deliveries, returns gift card balance it used
 * and disables gift cards it bought.
 */
export async function refundOrder(orderId: number): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .update(schema.orders)
      .set({ status: "refunded" })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "paid")))
      .returning();
    if (!order) return false;
    await revokeDeliveries(tx, orderId);
    await restoreGiftCards(tx, orderId);
    await tx.update(schema.giftCards).set({ active: false }).where(eq(schema.giftCards.orderId, orderId));
    return true;
  });
}

/**
 * Sends a paid order again with RECOVER, handy when a player lost their stuff.
 */
export async function recoverOrder(orderId: number): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);
    if (order?.status !== "paid") return false;
    await queueDeliveries(tx, orderId, "RECOVER");
    return true;
  });
}

export async function findOrderByPaymentIntent(paymentIntent: string) {
  const [order] = await getDb()
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.stripePaymentIntent, paymentIntent))
    .limit(1);
  return order ?? null;
}

/**
 * Saves a new subscription for its first order. Safe on webhook retries.
 */
export async function recordSubscription(orderId: number, stripeSubscriptionId: string, status: string, currentPeriodEnd: Date | null) {
  await getDb()
    .insert(schema.subscriptions)
    .values({ orderId, stripeSubscriptionId, status, currentPeriodEnd })
    .onConflictDoNothing({ target: schema.subscriptions.stripeSubscriptionId });
}

export async function updateSubscription(
  stripeSubscriptionId: string,
  values: { status: string; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean },
) {
  await getDb().update(schema.subscriptions).set(values).where(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

/**
 * A subscription stopped (cancelled or unpaid): the plugin gets a REFUND so the rank goes away.
 * Only the first call for a subscription does anything.
 */
export async function endSubscription(stripeSubscriptionId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [subscription] = await tx
      .update(schema.subscriptions)
      .set({ status: "canceled", endedAt: new Date(), cancelAtPeriodEnd: false })
      .where(and(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId), isNull(schema.subscriptions.endedAt)))
      .returning();
    if (!subscription) return false;
    const [order] = await tx
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, subscription.orderId))
      .limit(1);
    if (order?.status === "paid") await revokeDeliveries(tx, subscription.orderId);
    return true;
  });
}

/**
 * Logs a renewal payment as its own paid order (for revenue), without delivering anything again.
 */
export async function recordRenewal(stripeSubscriptionId: string, invoiceId: string, amountPaid: number, currentPeriodEnd: Date | null) {
  return getDb().transaction(async (tx) => {
    const [subscription] = await tx
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);
    if (!subscription) return null;
    const [original] = await tx.select().from(schema.orders).where(eq(schema.orders.id, subscription.orderId)).limit(1);
    if (!original) return null;

    const [renewal] = await tx
      .insert(schema.orders)
      .values({
        playerName: original.playerName,
        playerUuid: original.playerUuid,
        giftFrom: original.giftFrom,
        email: original.email,
        status: "paid",
        currency: original.currency,
        subtotal: amountPaid,
        total: amountPaid,
        stripeSubscriptionId,
        stripeInvoiceId: invoiceId,
        renewalOf: original.id,
        paidAt: new Date(),
      })
      .onConflictDoNothing({ target: schema.orders.stripeInvoiceId })
      .returning();
    if (!renewal) return null;

    const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, original.id));
    if (items.length > 0) {
      await tx.insert(schema.orderItems).values(
        items.map((item) => ({
          orderId: renewal.id,
          productId: item.productId,
          name: item.name,
          kind: item.kind,
          group: item.group,
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: amountPaid,
        })),
      );
    }
    await tx
      .update(schema.subscriptions)
      .set({ status: "active", currentPeriodEnd })
      .where(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return renewal.id;
  });
}
