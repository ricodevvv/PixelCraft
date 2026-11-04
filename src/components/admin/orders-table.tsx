import Link from "next/link";
import type { Order } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "./field";

export function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return <p className="text-sm text-muted">No orders yet.</p>;
  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="font-label text-left text-[10px] text-faint uppercase">
            <th className="px-6 py-2 font-normal">Order</th>
            <th className="px-3 py-2 font-normal">Player</th>
            <th className="px-3 py-2 font-normal">Status</th>
            <th className="px-3 py-2 text-right font-normal">Total</th>
            <th className="px-6 py-2 text-right font-normal">Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t-2 border-line/60 transition-colors hover:bg-surface-2">
              <td className="px-6 py-3">
                <Link href={`/admin/orders/${order.id}`} className="font-mono text-accent hover:underline">
                  #{order.id}
                </Link>
              </td>
              <td className="px-3 py-3">{order.playerName}</td>
              <td className="px-3 py-3">
                <StatusBadge status={order.status} />
              </td>
              <td className="px-3 py-3 text-right font-mono">{formatMoney(order.total, order.currency)}</td>
              <td className="px-6 py-3 text-right text-muted">{order.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
