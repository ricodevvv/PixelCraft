import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { LoaderCircle } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { subscriptionManageUrl } from "@/lib/subscription-link";
import { getBaseUrl } from "@/lib/url";
import { AutoRefresh, Celebration } from "@/components/store/celebration";
import { PlayerAvatar } from "@/components/store/player-avatar";

export const metadata: Metadata = { title: "Thanks!", robots: { index: false } };

type Props = { searchParams: Promise<{ order?: string; session?: string; preference_id?: string }> };

export default async function SuccessPage({ searchParams }: Props) {
  const settings = await getSettings();
  const dict = getDictionary(settings.locale);
  const params = await searchParams;
  const orderId = Number(params.order);

  const order = Number.isInteger(orderId)
    ? await getDb().query.orders.findFirst({
        where: eq(schema.orders.id, orderId),
        with: { items: true, giftCards: true },
      })
    : undefined;
  const paid = order?.status === "paid";
  const isBuyer = Boolean(
    (order?.stripeSessionId && params.session === order.stripeSessionId) ||
      (order?.mpPreferenceId && params.preference_id === order.mpPreferenceId),
  );
  const codes = paid && isBuyer ? order.giftCards : [];
  const manageUrl = paid && isBuyer && order.stripeSubscriptionId ? await subscriptionManageUrl(await getBaseUrl(), order.stripeSubscriptionId) : null;

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center px-5 pt-32 text-center">
      {paid && <Celebration />}
      {!paid && order?.status === "pending" && <AutoRefresh />}

      {order && (
        <div className="slot pixel-clip grid size-28 place-items-center [--step:6px]" data-reveal>
          <PlayerAvatar name={order.playerName} size={128} body className="h-24 w-auto" />
        </div>
      )}
      <h1 className="font-pixel mt-8 text-5xl leading-none font-bold" data-reveal>
        {dict.success.title}
      </h1>
      <p className="mt-4 text-muted" data-reveal>
        {paid ? dict.success.text : dict.success.pending}
      </p>
      {order?.giftFrom && (
        <p className="badge mt-4 bg-accent-2/20 text-accent-3" data-reveal>
          {dict.success.giftFor.replace("{name}", order.playerName)}
        </p>
      )}
      {!paid && order?.status === "pending" && <LoaderCircle className="mt-6 size-8 animate-spin text-accent" />}

      {order && (
        <div className="pixel-clip pixel-frame mt-10 w-full p-6 text-left [--step:5px]" data-reveal>
          <div className="flex items-center justify-between">
            <span className="font-label text-xs text-muted uppercase">
              {dict.success.order} #{order.id}
            </span>
            <span className="font-pixel text-xl text-accent">{formatMoney(order.total, order.currency, settings.locale)}</span>
          </div>
          <ul className="mt-4 space-y-2 border-t-2 border-line pt-4 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>
                  {item.quantity}× {item.name}
                </span>
                <span className="font-mono text-muted">{formatMoney(item.total, order.currency, settings.locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {codes.length > 0 && (
        <div className="pixel-clip mt-6 w-full border-2 border-dashed border-accent p-6 text-left [--step:5px]" data-reveal>
          <p className="font-label text-xs text-muted uppercase">{dict.success.codesTitle}</p>
          <ul className="mt-3 space-y-2">
            {codes.map((card) => (
              <li key={card.id} className="flex items-center justify-between gap-3">
                <span className="font-mono text-lg tracking-wider select-all">{card.code}</span>
                <span className="font-pixel text-accent">{formatMoney(card.initialBalance, card.currency, settings.locale)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">{dict.success.codesHint}</p>
        </div>
      )}

      {manageUrl && (
        <a href={manageUrl} className="btn btn-ghost mt-6">
          {dict.success.manage}
        </a>
      )}

      <Link href="/" className="btn btn-primary mt-10">
        {dict.success.back}
      </Link>
    </div>
  );
}
