import "server-only";
import { cache } from "react";
import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { Product } from "./db/schema";

export type ActiveSale = {
  id: number;
  name: string;
  percent: number;
  categoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  endsAt: Date;
};

export type SaleInfo = { name: string; percent: number; endsAt: string };

export type WithSale<T> = T & { sale: SaleInfo | null };

/**
 * Sales running right now, best discount first. Cached per request.
 */
export const getActiveSales = cache(async (): Promise<ActiveSale[]> =>
  getDb()
    .select({
      id: schema.sales.id,
      name: schema.sales.name,
      percent: schema.sales.percent,
      categoryId: schema.sales.categoryId,
      categoryName: schema.categories.name,
      categorySlug: schema.categories.slug,
      endsAt: schema.sales.endsAt,
    })
    .from(schema.sales)
    .leftJoin(schema.categories, eq(schema.sales.categoryId, schema.categories.id))
    .where(and(eq(schema.sales.active, true), lte(schema.sales.startsAt, sql`now()`), gt(schema.sales.endsAt, sql`now()`)))
    .orderBy(desc(schema.sales.percent), schema.sales.endsAt),
);

export function salePrice(price: number, percent: number): number {
  return Math.max(0, Math.round((price * (100 - percent)) / 100));
}

/**
 * The best running sale for a product: its category's or a store-wide one, whichever cuts more.
 */
export function saleFor(product: Pick<Product, "categoryId">, sales: ActiveSale[]): ActiveSale | null {
  return sales.find((sale) => sale.categoryId === null || sale.categoryId === product.categoryId) ?? null;
}

/**
 * Applies running sales to products. The sale price replaces price, and the old one shows up struck through.
 */
export function applySales<T extends Product>(products: T[], sales: ActiveSale[]): WithSale<T>[] {
  return products.map((product) => {
    const sale = saleFor(product, sales);
    if (!sale) return { ...product, sale: null };
    return {
      ...product,
      price: salePrice(product.price, sale.percent),
      comparePrice: Math.max(product.comparePrice ?? 0, product.price),
      sale: { name: sale.name, percent: sale.percent, endsAt: sale.endsAt.toISOString() },
    };
  });
}

export async function withSales<T extends Product>(products: T[]): Promise<WithSale<T>[]> {
  if (products.length === 0) return [];
  return applySales(products, await getActiveSales());
}
