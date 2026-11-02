import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

export const getCategories = cache(async () =>
  getDb().select().from(schema.categories).orderBy(asc(schema.categories.sort), asc(schema.categories.name)),
);

export async function getFeaturedProducts(limit = 8) {
  return getDb()
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.active, true), eq(schema.products.featured, true)))
    .orderBy(asc(schema.products.sort), asc(schema.products.id))
    .limit(limit);
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
  return { category, products };
}

export async function getProduct(slug: string) {
  const [row] = await getDb()
    .select({ product: schema.products, category: schema.categories })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(and(eq(schema.products.slug, slug), eq(schema.products.active, true)))
    .limit(1);
  return row ?? null;
}

export async function getProductCounts() {
  const rows = await getDb()
    .select({ categoryId: schema.products.categoryId, count: sql<number>`count(*)::int` })
    .from(schema.products)
    .where(eq(schema.products.active, true))
    .groupBy(schema.products.categoryId);
  return new Map(rows.map((row) => [row.categoryId, row.count]));
}

function startOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getRecentSupporters(limit = 8) {
  return getDb()
    .select({
      id: schema.orders.id,
      playerName: schema.orders.playerName,
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
    .select({ playerName: schema.orders.playerName, total: sql<number>`sum(${schema.orders.total})::int` })
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "paid"), gte(schema.orders.paidAt, startOfMonth())))
    .groupBy(schema.orders.playerName)
    .orderBy(desc(sql`sum(${schema.orders.total})`))
    .limit(1);
  return top ?? null;
}

export async function getMonthRevenue(): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${schema.orders.total}), 0)::int` })
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "paid"), gte(schema.orders.paidAt, startOfMonth())));
  return row?.total ?? 0;
}
