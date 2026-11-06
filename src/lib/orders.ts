import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { Coupon, Product } from "./db/schema";
import { withSales } from "./sales";

export type CartLine = { productId: number; quantity: number };

export type PricedLine = {
  product: Product;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  total: number;
  coupon: Coupon | null;
  couponError: string | null;
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
 * Prices a cart with fresh product data from the database. Never trust prices from the browser.
 */
export async function priceCart(input: CartLine[], couponCode?: string | null): Promise<PricedCart> {
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

  const lines = (await withSales(rows)).map((product) => {
    const quantity = Math.min(merged.get(product.id) ?? 1, Math.max(1, product.maxQuantity));
    return { product, quantity, unitPrice: product.price, total: product.price * quantity };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);

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

  const discount = coupon ? discountFor(coupon, subtotal) : 0;
  return { lines, subtotal, discount, total: subtotal - discount, coupon, couponError };
}

/**
 * Splits the order discount across lines so the plugin sees what was really paid per item.
 */
export function allocateDiscount(lines: PricedLine[], discount: number, subtotal: number): number[] {
  if (discount <= 0 || subtotal <= 0) return lines.map((line) => line.total);
  let remaining = discount;
  return lines.map((line, index) => {
    const share = index === lines.length - 1 ? remaining : Math.round((discount * line.total) / subtotal);
    remaining -= share;
    return line.total - share;
  });
}

async function queueDeliveries(tx: Tx, orderId: number, execution: "BUY" | "RECOVER" | "REFUND", groups?: string[]) {
  const targets =
    groups ??
    (
      await tx
        .selectDistinct({ group: schema.orderItems.group })
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, orderId))
    ).map((row) => row.group);
  if (targets.length === 0) return;
  await tx.insert(schema.deliveries).values(targets.map((group) => ({ orderId, group, execution })));
}

/**
 * Flips a pending order to paid and queues it for every server group in it.
 * Safe to call twice (webhook retries), only the first call does anything.
 */
export async function markOrderPaid(orderId: number, paymentIntent?: string | null): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .update(schema.orders)
      .set({ status: "paid", paidAt: new Date(), stripePaymentIntent: paymentIntent ?? null })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "pending")))
      .returning();
    if (!order) return false;

    await queueDeliveries(tx, orderId, "BUY");
    if (order.couponCode) {
      await tx
        .update(schema.coupons)
        .set({ uses: sql`${schema.coupons.uses} + 1` })
        .where(eq(schema.coupons.code, order.couponCode));
    }
    return true;
  });
}

export async function cancelOrder(orderId: number): Promise<boolean> {
  const rows = await getDb()
    .update(schema.orders)
    .set({ status: "cancelled" })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "pending")))
    .returning({ id: schema.orders.id });
  return rows.length > 0;
}

/**
 * Marks a paid order as refunded. Deliveries that never reached the server are dropped,
 * and groups that already got the items receive a REFUND so the plugin runs onRefund.
 */
export async function refundOrder(orderId: number): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .update(schema.orders)
      .set({ status: "refunded" })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "paid")))
      .returning();
    if (!order) return false;

    await tx
      .delete(schema.deliveries)
      .where(and(eq(schema.deliveries.orderId, orderId), isNull(schema.deliveries.deliveredAt)));

    const delivered = await tx
      .selectDistinct({ group: schema.deliveries.group })
      .from(schema.deliveries)
      .where(
        and(
          eq(schema.deliveries.orderId, orderId),
          eq(schema.deliveries.execution, "BUY"),
          isNotNull(schema.deliveries.deliveredAt),
        ),
      );
    await queueDeliveries(
      tx,
      orderId,
      "REFUND",
      delivered.map((row) => row.group),
    );
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
