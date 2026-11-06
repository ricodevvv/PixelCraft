import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { withSales } from "./sales";

export const getCategories = cache(async () =>
  getDb().select().from(schema.categories).orderBy(asc(schema.categories.sort), asc(schema.categories.name)),
);

export async function getFeaturedProducts(limit = 8) {
  const rows = await getDb()
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.active, true), eq(schema.products.featured, true)))
    .orderBy(asc(schema.products.sort), asc(schema.products.id))
    .limit(limit);
  return withSales(rows);
}

export async function getCategoryWithProducts(slug: string) {
  const db = getDb();
  const [category] = await db.select().from(schema.categories).where(eq(schema.categories.slug, slug)).limit(1);
  if (!category) return null;
  const products = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.categoryId, category.id), eq(schema.products.active, true)))
    .orderBy(asc(schema.products.sort), asc(schema.products.price));
  return { category, products: await withSales(products) };
}

export async function getProduct(slug: string) {
  const [row] = await getDb()
    .select({ product: schema.products, category: schema.categories })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(and(eq(schema.products.slug, slug), eq(schema.products.active, true)))
    .limit(1);
  if (!row) return null;
  const [product] = await withSales([row.product]);
  return { product, category: row.category };
}

export async function getProductCounts() {
  const rows = await getDb()
    .select({ categoryId: schema.products.categoryId, count: sql<number>`count(*)::int` })
    .from(schema.products)
    .where(eq(schema.products.active, true))
    .groupBy(schema.products.categoryId);
  return new Map(rows.map((row) => [row.categoryId, row.count]));
}

const supporter = sql<string>`coalesce(${schema.orders.giftFrom}, ${schema.orders.playerName})`;
const cash = sql`${schema.orders.total} - ${schema.orders.giftCardAmount}`;

function startOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getRecentSupporters(limit = 8) {
  return getDb()
    .select({
      id: schema.orders.id,
      playerName: sql<string>`coalesce(${schema.orders.giftFrom}, ${schema.orders.playerName})`,
      paidAt: schema.orders.paidAt,
      itemName: sql<string>`(select ${schema.orderItems.name} from ${schema.orderItems} where ${schema.orderItems.orderId} = ${schema.orders.id} order by ${schema.orderItems.total} desc limit 1)`,
    })
    .from(schema.orders)
    .where(eq(schema.orders.status, "paid"))
    .orderBy(desc(schema.orders.paidAt))
    .limit(limit);
}

export async function getTopSupporter() {
  const [top] = await getDb()
    .select({ playerName: supporter, total: sql<number>`sum(${cash})::int` })
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "paid"), gte(schema.orders.paidAt, startOfMonth())))
    .groupBy(supporter)
    .orderBy(desc(sql`sum(${cash})`))
    .limit(1);
  return top ?? null;
}

export async function getMonthRevenue(): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${cash}), 0)::int` })
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "paid"), gte(schema.orders.paidAt, startOfMonth())));
  return row?.total ?? 0;
}
