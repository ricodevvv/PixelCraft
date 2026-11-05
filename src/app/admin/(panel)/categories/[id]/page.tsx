import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { ConfirmButton } from "@/components/admin/form";
import { PageHeader } from "@/components/admin/field";
import { CategoryForm } from "@/components/admin/category-form";
import { deleteCategory } from "../../../actions";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [category] = await getDb().select().from(schema.categories).where(eq(schema.categories.id, id)).limit(1);
  if (!category) notFound();

  return (
    <>
      <PageHeader
        title={category.name}
        actions={
          <form action={deleteCategory}>
            <input type="hidden" name="id" value={category.id} />
            <ConfirmButton message={`Delete ${category.name}? Its products stay, just without a category.`} className="btn btn-danger btn-sm">
              <Trash2 className="size-3.5" /> Delete
            </ConfirmButton>
          </form>
        }
      />
      <CategoryForm category={category} />
    </>
  );
}
