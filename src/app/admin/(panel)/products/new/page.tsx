import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/field";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const db = getDb();
  const [settings, categories, servers] = await Promise.all([
    getSettings(),
    db.select().from(schema.categories).orderBy(asc(schema.categories.sort)),
    db.selectDistinct({ group: schema.servers.group }).from(schema.servers),
  ]);
  return (
    <>
      <PageHeader title="New product" />
      <ProductForm categories={categories} groups={servers.map((row) => row.group)} currency={settings.currency} />
    </>
  );
}
