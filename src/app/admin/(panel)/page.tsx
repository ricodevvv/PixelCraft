import Link from "next/link";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { currencyDigits, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { PageHeader, Panel } from "@/components/admin/field";
import { OrdersTable } from "@/components/admin/orders-table";
import { RevenueChart } from "@/components/admin/revenue-chart";

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

export default async function DashboardPage() {
  const settings = await getSettings();
  const db = getDb();
  const since = daysAgo(29);
  const money = (amount: number) => formatMoney(amount, settings.currency, "en");

  const [daily, [pending], recent, [servers]] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${schema.orders.paidAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
        total: sql<number>`sum(${schema.orders.total})::int`,
        orders: sql<number>`count(*)::int`,
      })
      .from(schema.orders)
      .where(and(eq(schema.orders.status, "paid"), gte(schema.orders.paidAt, since)))
      .groupBy(sql`1`),
    db.select({ value: count() }).from(schema.deliveries).where(isNull(schema.deliveries.deliveredAt)),
    db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).limit(8),
    db.select({ value: count() }).from(schema.servers),
  ]);

  const byDay = new Map(daily.map((row) => [row.day, row]));
  const series = Array.from({ length: 30 }, (_, index) => {
    const date = daysAgo(29 - index).toISOString().slice(0, 10);
    const row = byDay.get(date);
    return { date, total: row?.total ?? 0, orders: row?.orders ?? 0 };
  });
  const revenue = series.reduce((sum, point) => sum + point.total, 0);
  const orders = series.reduce((sum, point) => sum + point.orders, 0);

  const stats = [
    { label: "Revenue · 30 days", value: money(revenue) },
    { label: "Orders · 30 days", value: orders.toLocaleString() },
    { label: "Average order", value: money(orders ? Math.round(revenue / orders) : 0) },
    { label: "Waiting for delivery", value: pending.value.toLocaleString() },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="How the store is doing lately." />

      {servers.value === 0 && (
        <Link
          href="/admin/servers"
          className="pixel-clip mb-6 block bg-accent/10 px-5 py-4 text-sm text-accent transition-colors hover:bg-accent/15 [--step:4px]"
        >
          No servers connected yet. Add one to get the PixelBuy plugin config →
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="pixel-clip pixel-frame p-5 [--step:5px]">
            <p className="font-label text-[11px] text-muted uppercase">{stat.label}</p>
            <p className="font-pixel mt-3 text-3xl">{stat.value}</p>
          </div>
        ))}
      </div>

      <Panel title="Daily revenue" className="mt-6">
        <RevenueChart
          data={series}
          format={{ currency: settings.currency, locale: "en", digits: currencyDigits(settings.currency) }}
        />
      </Panel>

      <Panel
        title="Latest orders"
        className="mt-6"
        actions={
          <Link href="/admin/orders" className="btn btn-ghost btn-sm">
            See all
          </Link>
        }
      >
        <OrdersTable orders={recent} />
      </Panel>
    </>
  );
}
