import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { AdminForm, ConfirmButton } from "@/components/admin/form";
import { DateTimeInput, LocalTime } from "@/components/admin/date-time-input";
import { Field, PageHeader, Panel } from "@/components/admin/field";
import { createSale, deleteSale, toggleSale } from "../../actions";

export const metadata: Metadata = { title: "Sales" };

function status(sale: { active: boolean; startsAt: Date; endsAt: Date }) {
  const now = Date.now();
  if (!sale.active) return { label: "off", style: "bg-surface-3 text-faint" };
  if (sale.endsAt.getTime() <= now) return { label: "ended", style: "bg-surface-3 text-faint" };
  if (sale.startsAt.getTime() > now) return { label: "scheduled", style: "bg-warning/15 text-warning" };
  return { label: "live", style: "bg-accent/15 text-accent" };
}

export default async function SalesPage() {
  const db = getDb();
  const [sales, categories] = await Promise.all([
    db
      .select({ sale: schema.sales, category: schema.categories.name })
      .from(schema.sales)
      .leftJoin(schema.categories, eq(schema.sales.categoryId, schema.categories.id))
      .orderBy(desc(schema.sales.startsAt)),
    db.select().from(schema.categories).orderBy(asc(schema.categories.sort)),
  ]);

  return (
    <>
      <PageHeader
        title="Sales"
        description="Timed discounts for a category or the whole store. When two overlap, the bigger one wins, and coupons stack on top."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel>
          {sales.length === 0 ? (
            <p className="text-sm text-muted">No sales yet.</p>
          ) : (
            <ul className="divide-y-2 divide-line/60">
              {sales.map(({ sale, category }) => {
                const state = status(sale);
                return (
                  <li key={sale.id} className="flex flex-wrap items-center gap-4 py-3">
                    <span className="font-pixel w-16 text-2xl text-accent">-{sale.percent}%</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{sale.name}</p>
                      <p className="text-xs text-muted">
                        {category ?? "Whole store"} · <LocalTime iso={sale.startsAt.toISOString()} /> → <LocalTime iso={sale.endsAt.toISOString()} />
                      </p>
                    </div>
                    <span className={`badge ${state.style}`}>{state.label}</span>
                    <form action={toggleSale}>
                      <input type="hidden" name="id" value={sale.id} />
                      <input type="hidden" name="active" value={String(!sale.active)} />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        {sale.active ? "Disable" : "Enable"}
                      </button>
                    </form>
                    <form action={deleteSale}>
                      <input type="hidden" name="id" value={sale.id} />
                      <ConfirmButton message={`Delete ${sale.name}?`} className="btn btn-ghost btn-sm !p-2">
                        <Trash2 className="size-3.5" />
                      </ConfirmButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="New sale" className="h-fit">
          <AdminForm action={createSale} submitLabel="Create sale">
            <div className="space-y-4">
              <Field label="Name" hint="Shown on the store banner.">
                <input name="name" required maxLength={60} placeholder="Weekend sale" className="input" />
              </Field>
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <Field label="Discount %">
                  <input name="percent" type="number" min={1} max={90} required defaultValue={20} className="input font-mono" />
                </Field>
                <Field label="Applies to">
                  <select name="scope" defaultValue="all" className="input">
                    <option value="all">Whole store</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Starts">
                <DateTimeInput name="startsAt" required />
              </Field>
              <Field label="Ends">
                <DateTimeInput name="endsAt" required />
              </Field>
            </div>
          </AdminForm>
        </Panel>
      </div>
    </>
  );
}
