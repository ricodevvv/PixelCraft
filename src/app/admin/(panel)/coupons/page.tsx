import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { couponProblem } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { AdminForm, ConfirmButton } from "@/components/admin/form";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { Field, PageHeader, Panel } from "@/components/admin/field";
import { createCoupon, deleteCoupon, toggleCoupon } from "../../actions";

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const [settings, coupons] = await Promise.all([
    getSettings(),
    getDb().select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt)),
  ]);

  return (
    <>
      <PageHeader title="Coupons" description="Discount codes players type in the cart." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel>
          {coupons.length === 0 ? (
            <p className="text-sm text-muted">No coupons yet.</p>
          ) : (
            <ul className="divide-y-2 divide-line/60">
              {coupons.map((coupon) => {
                const problem = couponProblem(coupon);
                return (
                  <li key={coupon.id} className="flex flex-wrap items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-lg font-semibold">{coupon.code}</p>
                      <p className="text-xs text-muted">
                        {coupon.type === "percent" ? `${coupon.value}% off` : `${formatMoney(coupon.value, settings.currency)} off`} · used{" "}
                        {coupon.uses}
                        {coupon.maxUses !== null && `/${coupon.maxUses}`}
                        {coupon.expiresAt && ` · expires ${coupon.expiresAt.toISOString().slice(0, 10)}`}
                      </p>
                    </div>
                    <span className={`badge ${problem ? "bg-surface-3 text-faint" : "bg-accent/15 text-accent"}`}>
                      {problem === "invalid" ? "disabled" : problem ?? "active"}
                    </span>
                    <form action={toggleCoupon}>
                      <input type="hidden" name="id" value={coupon.id} />
                      <input type="hidden" name="active" value={String(!coupon.active)} />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        {coupon.active ? "Disable" : "Enable"}
                      </button>
                    </form>
                    <form action={deleteCoupon}>
                      <input type="hidden" name="id" value={coupon.id} />
                      <ConfirmButton message={`Delete ${coupon.code}?`} className="btn btn-ghost btn-sm !p-2">
                        <Trash2 className="size-3.5" />
                      </ConfirmButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="New coupon">
          <AdminForm action={createCoupon} submitLabel="Create coupon">
            <div className="space-y-4">
              <Field label="Code">
                <input name="code" required placeholder="SUMMER25" className="input font-mono uppercase" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select name="type" className="input">
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed ({settings.currency})</option>
                  </select>
                </Field>
                <Field label="Value">
                  <input name="value" type="number" step="0.01" min="0" required className="input font-mono" />
                </Field>
              </div>
              <Field label="Max uses" hint="Empty means unlimited.">
                <input name="maxUses" type="number" min="1" className="input font-mono" />
              </Field>
              <Field label="Expires" hint="Optional.">
                <DateTimeInput name="expiresAt" />
              </Field>
            </div>
          </AdminForm>
        </Panel>
      </div>
    </>
  );
}
