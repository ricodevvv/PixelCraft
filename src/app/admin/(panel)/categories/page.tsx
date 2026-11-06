import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { getProductCounts } from "@/lib/catalog";
import { PageHeader } from "@/components/admin/field";
import { ItemImage } from "@/components/ui/item-image";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const [categories, counts] = await Promise.all([
    getDb().select().from(schema.categories).orderBy(asc(schema.categories.sort), asc(schema.categories.name)),
    getProductCounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Categories"
        description="Groups of products. They show up in the store menu."
        actions={
          <Link href="/admin/categories/new" className="btn btn-primary">
            <Plus className="size-4" /> New category
          </Link>
        }
      />
      {categories.length === 0 ? (
        <p className="text-sm text-muted">No categories yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/admin/categories/${category.id}`}
              className="pixel-clip pixel-frame flex items-center gap-4 p-5 [--step:5px] hover:[--frame:var(--accent-deep)]"
            >
              <span className="slot pixel-clip grid size-14 shrink-0 place-items-center [--step:3px]">
                <ItemImage src={category.image} seed={`category-${category.slug}`} className="size-10 object-contain" spriteClassName="size-10" />
              </span>
              <span className="min-w-0">
                <span className="font-pixel block text-xl">{category.name}</span>
                <span className="text-sm text-muted">
                  {counts.get(category.id) ?? 0} live products · sort {category.sort}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
