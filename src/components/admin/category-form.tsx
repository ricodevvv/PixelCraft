import type { Category } from "@/lib/db/schema";
import { isStorageConfigured } from "@/lib/storage";
import { saveCategory } from "@/app/admin/actions";
import { AdminForm } from "./form";
import { Field, Panel } from "./field";
import { ImageField } from "./image-field";
import { SlugInput } from "./slug-input";

export function CategoryForm({ category }: { category?: Category }) {
  return (
    <AdminForm action={saveCategory} submitLabel={category ? "Save changes" : "Create category"}>
      <input type="hidden" name="id" value={category?.id ?? ""} />
      <Panel>
        <div className="space-y-5">
          <SlugInput defaultName={category?.name ?? ""} defaultSlug={category?.slug ?? ""} />
          <Field label="Description">
            <textarea name="description" defaultValue={category?.description} rows={3} maxLength={300} className="input resize-y" />
          </Field>
          <ImageField
            name="image"
            label="Image"
            hint="Optional. A pixel sprite is generated when empty."
            defaultValue={category?.image ?? ""}
            folder="categories"
            uploadEnabled={isStorageConfigured()}
            spriteSeed={category ? `category-${category.slug}` : ""}
          />
          <Field label="Sort order" className="max-w-40">
            <input name="sort" type="number" defaultValue={category?.sort ?? 0} className="input font-mono" />
          </Field>
        </div>
      </Panel>
    </AdminForm>
  );
}
