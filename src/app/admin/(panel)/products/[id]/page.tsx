import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ExternalLink, Trash2 } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ConfirmButton } from "@/components/admin/form";
import { PageHeader } from "@/components/admin/field";
import { ProductForm } from "@/components/admin/product-form";
import { deleteProduct } from "../../../actions";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = getDb();
  const [settings, [product], categories, servers] = await Promise.all([
    getSettings(),
    db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1),
    db.select().from(schema.categories).orderBy(asc(schema.categories.sort)),
    db.selectDistinct({ group: schema.servers.group }).from(schema.servers),
  ]);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={product.name}
        actions={
          <div className="flex gap-2">
            <Link href={`/product/${product.slug}`} target="_blank" className="btn btn-ghost btn-sm">
              <ExternalLink className="size-3.5" /> View
            </Link>
            <form action={deleteProduct}>
              <input type="hidden" name="id" value={product.id} />
              <ConfirmButton message={`Delete ${product.name}? Past orders keep their history.`} className="btn btn-danger btn-sm">
                <Trash2 className="size-3.5" /> Delete
              </ConfirmButton>
            </form>
          </div>
        }
      />
      <ProductForm product={product} categories={categories} groups={servers.map((row) => row.group)} currency={settings.currency} />
    </>
  );
}
