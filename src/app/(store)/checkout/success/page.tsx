import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { LoaderCircle } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { AutoRefresh, Celebration } from "@/components/store/celebration";
import { PlayerAvatar } from "@/components/store/player-avatar";

export const metadata: Metadata = { title: "Thanks!", robots: { index: false } };

type Props = { searchParams: Promise<{ order?: string }> };

export default async function SuccessPage({ searchParams }: Props) {
  const settings = await getSettings();
  const dict = getDictionary(settings.locale);
  const orderId = Number((await searchParams).order);

  const order = Number.isInteger(orderId)
    ? await getDb().query.orders.findFirst({ where: eq(schema.orders.id, orderId), with: { items: true } })
    : undefined;
  const paid = order?.status === "paid";

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

      <Link href="/" className="btn btn-primary mt-10">
        {dict.success.back}
      </Link>
    </div>
  );
}
