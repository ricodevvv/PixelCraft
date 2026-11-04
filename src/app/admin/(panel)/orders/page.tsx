import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { Search } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { PageHeader, Panel } from "@/components/admin/field";
import { OrdersTable } from "@/components/admin/orders-table";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 25;
const statuses = ["all", "paid", "pending", "refunded", "cancelled"] as const;

type Props = { searchParams: Promise<{ status?: string; q?: string; page?: string }> };

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = statuses.find((value) => value === params.status) ?? "all";
  const query = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const filters: SQL[] = [];
  if (status !== "all") filters.push(eq(schema.orders.status, status));
  if (query) {
    const asId = Number(query.replace("#", ""));
    filters.push(
      or(
        ilike(schema.orders.playerName, `%${query}%`),
        ilike(schema.orders.email, `%${query}%`),
        ...(Number.isInteger(asId) && asId > 0 ? [eq(schema.orders.id, asId)] : []),
      )!,
    );
  }
  const where = filters.length ? and(...filters) : undefined;

  const db = getDb();
  const [orders, [total]] = await Promise.all([
    db
      .select()
      .from(schema.orders)
      .where(where)
      .orderBy(desc(schema.orders.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(schema.orders).where(where),
  ]);
  const pages = Math.max(1, Math.ceil(total.value / PAGE_SIZE));

  const link = (next: Partial<{ status: string; page: number }>) => {
    const search = new URLSearchParams();
    const nextStatus = next.status ?? status;
    if (nextStatus !== "all") search.set("status", nextStatus);
    if (query) search.set("q", query);
    if ((next.page ?? 1) > 1) search.set("page", String(next.page));
    const value = search.toString();
    return value ? `/admin/orders?${value}` : "/admin/orders";
  };

  return (
    <>
      <PageHeader title="Orders" description={`${total.value.toLocaleString()} orders`} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {statuses.map((value) => (
            <Link
              key={value}
              href={link({ status: value })}
              className={`pixel-clip px-3 py-2 text-sm capitalize [--step:3px] ${value === status ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-text"}`}
            >
              {value}
            </Link>
          ))}
        </div>
        <form className="relative ml-auto w-full sm:w-72">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-faint" />
          <input name="q" defaultValue={query} placeholder="Player, email or #id" className="input !py-2.5 !pl-9" />
        </form>
      </div>
      <Panel>
        <OrdersTable orders={orders} />
      </Panel>
      {pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={link({ page: page - 1 })} className="btn btn-ghost btn-sm">
              Previous
            </Link>
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={link({ page: page + 1 })} className="btn btn-ghost btn-sm">
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
