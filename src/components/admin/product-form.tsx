import type { Category, Product } from "@/lib/db/schema";
import { toMajor } from "@/lib/money";
import { isStorageConfigured } from "@/lib/storage";
import { saveProduct } from "@/app/admin/actions";
import { AdminForm } from "./form";
import { Field, Panel, Toggle } from "./field";
import { ImageField } from "./image-field";
import { SlugInput } from "./slug-input";

type Props = { product?: Product; categories: Category[]; groups: string[]; currency: string };

export function ProductForm({ product, categories, groups, currency }: Props) {
  const major = (value: number | null | undefined) => (value === null || value === undefined ? "" : toMajor(value, currency));
  return (
    <AdminForm action={saveProduct} submitLabel={product ? "Save changes" : "Create product"}>
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Product">
          <div className="space-y-5">
            <SlugInput defaultName={product?.name ?? ""} defaultSlug={product?.slug ?? ""} />
            <Field label="Tagline" hint="One line shown on the card.">
              <input name="tagline" defaultValue={product?.tagline} maxLength={160} className="input" />
            </Field>
            <Field label="Description" hint="Plain text, line breaks are kept.">
              <textarea name="description" defaultValue={product?.description} rows={7} className="input resize-y" />
            </Field>
            <ImageField
              name="image"
              label="Image"
              hint="Optional. PNG, JPG, WebP or GIF up to 4 MB. Leave it empty to use a generated pixel sprite."
              defaultValue={product?.image ?? ""}
              folder="products"
              uploadEnabled={isStorageConfigured()}
              spriteSeed={product?.slug ?? ""}
            />
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Type">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Kind">
                <select name="kind" defaultValue={product?.kind ?? "item"} className="input">
                  <option value="item">Item or rank</option>
                  <option value="subscription">Subscription</option>
                  <option value="giftcard">Gift card</option>
                </select>
              </Field>
              <Field label="Billing" hint="Only for subscriptions.">
                <select name="interval" defaultValue={product?.interval ?? "month"} className="input">
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </Field>
            </div>
            <p className="mt-4 text-xs text-faint">
              Subscriptions renew through Stripe and get a REFUND in-game when they end. Gift cards are sold as codes worth their
              price, they skip sales and coupons and don&apos;t need delivery settings.
            </p>
          </Panel>

          <Panel title="Pricing">
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Price (${currency})`}>
                <input name="price" type="number" step="0.01" min="0" required defaultValue={major(product?.price)} className="input font-mono" />
              </Field>
              <Field label="Compare at" hint="Shows a sale badge.">
                <input name="comparePrice" type="number" step="0.01" min="0" defaultValue={major(product?.comparePrice)} className="input font-mono" />
              </Field>
              <Field label="Max per order" className="col-span-2">
                <input name="maxQuantity" type="number" min="1" max="999" defaultValue={product?.maxQuantity ?? 1} className="input font-mono" />
              </Field>
            </div>
          </Panel>

          <Panel title="Delivery">
            <div className="space-y-5">
              <Field label="Server group" hint="Matches the Group of the server that should deliver it. Not used by gift cards.">
                <input name="group" list="server-groups" defaultValue={product?.group ?? groups[0] ?? ""} className="input font-mono" />
                <datalist id="server-groups">
                  {groups.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
              </Field>
              <Field label="PixelBuy item id" hint="The key of the item in the plugin's storeitems config, like rank-vip.">
                <input name="itemId" defaultValue={product?.itemId} className="input font-mono" />
              </Field>
            </div>
          </Panel>

          <Panel title="Display">
            <div className="space-y-5">
              <Field label="Category">
                <select name="categoryId" defaultValue={product?.categoryId ?? ""} className="input">
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sort order" hint="Lower numbers show first.">
                <input name="sort" type="number" defaultValue={product?.sort ?? 0} className="input font-mono" />
              </Field>
              <Toggle name="active" label="Visible in the store" defaultChecked={product?.active ?? true} />
              <Toggle name="featured" label="Featured on the home page" defaultChecked={product?.featured ?? false} />
            </div>
          </Panel>
        </div>
      </div>
    </AdminForm>
  );
}
