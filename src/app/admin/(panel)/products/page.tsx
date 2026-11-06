import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { PageHeader, Panel } from "@/components/admin/field";
import { PixelSprite } from "@/components/ui/pixel-sprite";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const settings = await getSettings();
  const rows = await getDb()
    .select({ product: schema.products, category: schema.categories.name })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .orderBy(asc(schema.categories.sort), asc(schema.products.sort), asc(schema.products.id));

  return (
    <>
      <PageHeader
        title="Products"
        description="What players can buy. Each one maps to an item in the PixelBuy plugin."
        actions={
          <Link href="/admin/products/new" className="btn btn-primary">
            <Plus className="size-4" /> New product
          </Link>
        }
      />
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No products yet.</p>
        ) : (
          <div className="-mx-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="font-label text-left text-[10px] text-faint uppercase">
                  <th className="px-6 py-2 font-normal">Product</th>
                  <th className="px-3 py-2 font-normal">Category</th>
                  <th className="px-3 py-2 font-normal">Delivery</th>
                  <th className="px-3 py-2 text-right font-normal">Price</th>
                  <th className="px-6 py-2 text-right font-normal">State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, category }) => (
                  <tr key={product.id} className="border-t-2 border-line/60 transition-colors hover:bg-surface-2">
                    <td className="px-6 py-3">
                      <Link href={`/admin/products/${product.id}`} className="flex items-center gap-3">
                        <span className="slot pixel-clip grid size-10 shrink-0 place-items-center [--step:2px]">
                          {product.image ? (
                            <img src={product.image} alt="" className="size-7 object-contain" />
                          ) : (
                            <PixelSprite seed={product.slug} className="size-7" />
                          )}
                        </span>
                        <span>
                          <span className="block font-semibold hover:text-accent">{product.name}</span>
                          <span className="font-mono text-xs text-faint">/{product.slug}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted">{category ?? "—"}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted">
                      {product.itemId} → {product.group}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{formatMoney(product.price, settings.currency)}</td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex gap-1">
                        {product.kind !== "item" && (
                          <span className="badge bg-warning/15 text-warning">{product.kind === "giftcard" ? "gift card" : `per ${product.interval ?? "month"}`}</span>
                        )}
                        {product.featured && <span className="badge bg-accent-2/20 text-accent-3">featured</span>}
                        <span className={`badge ${product.active ? "bg-accent/15 text-accent" : "bg-surface-3 text-faint"}`}>
                          {product.active ? "live" : "hidden"}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
