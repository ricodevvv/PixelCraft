import type { Category } from "@/lib/db/schema";
import { saveCategory } from "@/app/admin/actions";
import { AdminForm } from "./form";
import { Field, Panel } from "./field";
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
          <div className="grid gap-5 sm:grid-cols-[1fr_160px]">
            <Field label="Image URL" hint="Optional. A pixel sprite is generated when empty.">
              <input name="image" type="url" defaultValue={category?.image ?? ""} placeholder="https://..." className="input" />
            </Field>
            <Field label="Sort order">
              <input name="sort" type="number" defaultValue={category?.sort ?? 0} className="input font-mono" />
            </Field>
          </div>
        </div>
      </Panel>
    </AdminForm>
  );
}
