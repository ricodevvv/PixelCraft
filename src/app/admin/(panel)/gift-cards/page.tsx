import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { AdminForm } from "@/components/admin/form";
import { Field, PageHeader, Panel } from "@/components/admin/field";
import { createGiftCard, toggleGiftCard } from "../../actions";

export const metadata: Metadata = { title: "Gift cards" };

export default async function GiftCardsPage() {
  const [settings, cards] = await Promise.all([
    getSettings(),
    getDb().select().from(schema.giftCards).orderBy(desc(schema.giftCards.createdAt)).limit(200),
  ]);

  return (
    <>
      <PageHeader
        title="Gift cards"
        description="Codes bought in the store show up here. You can also make your own for giveaways."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel>
          {cards.length === 0 ? (
            <p className="text-sm text-muted">No gift cards yet. Sell them by creating a product of kind Gift card.</p>
          ) : (
            <ul className="divide-y-2 divide-line/60">
              {cards.map((card) => (
                <li key={card.id} className="flex flex-wrap items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-base font-semibold tracking-wider">{card.code}</p>
                    <p className="text-xs text-muted">
                      {formatMoney(card.balance, card.currency)} left of {formatMoney(card.initialBalance, card.currency)} ·{" "}
                      {card.orderId ? (
                        <Link href={`/admin/orders/${card.orderId}`} className="text-accent hover:underline">
                          order #{card.orderId}
                        </Link>
                      ) : (
                        "made by hand"
                      )}
                    </p>
                  </div>
                  <span
                    className={`badge ${!card.active ? "bg-surface-3 text-faint" : card.balance > 0 ? "bg-accent/15 text-accent" : "bg-surface-3 text-muted"}`}
                  >
                    {!card.active ? "disabled" : card.balance > 0 ? "active" : "spent"}
                  </span>
                  <form action={toggleGiftCard}>
                    <input type="hidden" name="id" value={card.id} />
                    <input type="hidden" name="active" value={String(!card.active)} />
                    <button type="submit" className="btn btn-ghost btn-sm">
                      {card.active ? "Disable" : "Enable"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="New gift card" className="h-fit">
          <AdminForm action={createGiftCard} submitLabel="Create gift card">
            <div className="space-y-4">
              <Field label={`Amount (${settings.currency})`}>
                <input name="amount" type="number" step="0.01" min="0.01" required className="input font-mono" />
              </Field>
              <Field label="Code" hint="Leave empty for a random one like PX-ABCD-EFGH-JKLM.">
                <input name="code" placeholder="SUMMER-GIVEAWAY" className="input font-mono uppercase" />
              </Field>
            </div>
          </AdminForm>
        </Panel>
      </div>
    </>
  );
}
