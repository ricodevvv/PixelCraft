import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/field";
import { CategoryForm } from "@/components/admin/category-form";

export const metadata: Metadata = { title: "New category" };

export default function NewCategoryPage() {
  return (
    <>
      <PageHeader title="New category" />
      <CategoryForm />
    </>
  );
}
