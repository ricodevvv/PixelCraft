import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ConfirmButton } from "@/components/admin/form";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/field";
import { orderAction } from "../../../actions";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order #${(await params).id}` };
}

function when(date: Date | null) {
  return date ? date.toISOString().slice(0, 19).replace("T", " ") + " UTC" : "—";
}

export default async function OrderPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const order = await getDb().query.orders.findFirst({
    where: eq(schema.orders.id, id),
    with: {
      items: true,
      deliveries: { orderBy: asc(schema.deliveries.createdAt) },
      giftCards: true,
      subscriptions: true,
    },
  });
  if (!order) notFound();
  const money = (amount: number) => formatMoney(amount, order.currency);
  const subscription = order.subscriptions[0] ?? null;

  const actions = (
    <div className="flex flex-wrap gap-2">
      {subscription && !subscription.endedAt && (
        <form action={orderAction}>
          <input type="hidden" name="id" value={order.id} />
          <input type="hidden" name="action" value="cancel-subscription" />
          <ConfirmButton message="Cancel this subscription now? The plugin gets a REFUND and the rank goes away.">
            Cancel subscription
          </ConfirmButton>
        </form>
      )}
      {order.status === "paid" && !order.renewalOf && (
        <form action={orderAction}>
          <input type="hidden" name="id" value={order.id} />
          <input type="hidden" name="action" value="recover" />
          <ConfirmButton message="Send this order to the servers again (RECOVER)?">Resend</ConfirmButton>
        </form>
      )}
      {order.status === "paid" && (
        <form action={orderAction}>
          <input type="hidden" name="id" value={order.id} />
          <input type="hidden" name="action" value="refund" />
          <ConfirmButton
            className="btn btn-danger btn-sm"
            message={
              order.mpPaymentId
                ? "Refund the payment in Mercado Pago and run onRefund in-game?"
                : order.stripePaymentIntent
                ? "Refund the payment in Stripe and run onRefund in-game?"
                : "Mark as refunded and run onRefund in-game?"
            }
          >
            Refund
          </ConfirmButton>
        </form>
      )}
      {order.status === "pending" && (
        <>
          <form action={orderAction}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="action" value="mark-paid" />
            <ConfirmButton className="btn btn-primary btn-sm" message="Mark as paid and deliver? Only do this if you got the money another way.">
              Mark as paid
            </ConfirmButton>
          </form>
          <form action={orderAction}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="action" value="cancel" />
            <ConfirmButton message="Cancel this order?">Cancel</ConfirmButton>
          </form>
        </>
      )}
    </div>
  );

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <PageHeader title={`Order #${order.id}`} actions={actions} />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Items">
          <ul className="divide-y-2 divide-line/60">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-semibold">
                    {item.quantity}× {item.name}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {item.itemId} → {item.group}
                  </p>
                </div>
                <span className="font-mono">{money(item.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t-2 border-line pt-4 text-sm">
            <div className="flex justify-between text-muted">
              <dt>Subtotal</dt>
              <dd className="font-mono">{money(order.subtotal)}</dd>
            </div>
            {order.giftCardAmount > 0 && (
              <div className="flex justify-between text-accent-3">
                <dt>Paid with gift card</dt>
                <dd className="font-mono">-{money(order.giftCardAmount)}</dd>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-accent">
                <dt>Discount ({order.couponCode})</dt>
                <dd className="font-mono">-{money(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="font-mono">{money(order.total)}</dd>
            </div>
          </dl>
        </Panel>

        <div className="space-y-6">
          <Panel title="Details">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Status</dt>
                <dd>
                  <StatusBadge status={order.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Player</dt>
                <dd className="font-semibold">{order.playerName}</dd>
              </div>
              {order.giftFrom && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Gift from</dt>
                  <dd className="font-semibold">{order.giftFrom}</dd>
                </div>
              )}
              {order.renewalOf && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Renewal of</dt>
                  <dd>
                    <Link href={`/admin/orders/${order.renewalOf}`} className="font-mono text-accent hover:underline">
                      #{order.renewalOf}
                    </Link>
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">UUID</dt>
                <dd className="truncate font-mono text-xs">{order.playerUuid ?? "offline / bedrock"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Email</dt>
                <dd className="truncate">{order.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Created</dt>
                <dd className="font-mono text-xs">{when(order.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Paid</dt>
                <dd className="font-mono text-xs">{when(order.paidAt)}</dd>
              </div>
              {order.paymentProvider && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Paid with</dt>
                  <dd>{order.paymentProvider === "mercadopago" ? "Mercado Pago" : "Stripe"}</dd>
                </div>
              )}
              {order.mpPaymentId && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">MP payment</dt>
                  <dd className="font-mono text-xs">{order.mpPaymentId}</dd>
                </div>
              )}
              {order.stripePaymentIntent && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Stripe</dt>
                  <dd>
                    <a
                      href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntent}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {order.stripePaymentIntent}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </Panel>

          {subscription && (
            <Panel title="Subscription">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Status</dt>
                  <dd>
                    <span className={`badge ${subscription.endedAt ? "bg-surface-3 text-faint" : "bg-accent/15 text-accent"}`}>
                      {subscription.cancelAtPeriodEnd && !subscription.endedAt ? "cancels at period end" : subscription.status}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{subscription.endedAt ? "Ended" : "Renews"}</dt>
                  <dd className="font-mono text-xs">{when(subscription.endedAt ?? subscription.currentPeriodEnd)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Stripe</dt>
                  <dd>
                    <a
                      href={`https://dashboard.stripe.com/subscriptions/${subscription.stripeSubscriptionId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {subscription.stripeSubscriptionId}
                    </a>
                  </dd>
                </div>
              </dl>
            </Panel>
          )}

          {order.giftCards.length > 0 && (
            <Panel title="Gift cards issued">
              <ul className="space-y-2 text-sm">
                {order.giftCards.map((card) => (
                  <li key={card.id} className="flex items-center justify-between gap-3">
                    <span className="font-mono tracking-wider">{card.code}</span>
                    <span className="text-muted">
                      {money(card.balance)} / {money(card.initialBalance)}
                      {!card.active && " · disabled"}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Deliveries">
            {order.deliveries.length === 0 ? (
              <p className="text-sm text-muted">Nothing queued yet. Deliveries show up once the order is paid.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {order.deliveries.map((delivery) => (
                  <li key={delivery.id} className="flex items-center justify-between gap-3">
                    <span>
                      <span className="badge bg-surface-3 text-muted">{delivery.execution}</span>{" "}
                      <span className="font-mono">{delivery.group}</span>
                    </span>
                    <span className={delivery.deliveredAt ? "text-accent" : "text-warning"}>
                      {delivery.deliveredAt ? `done ${when(delivery.deliveredAt)}` : "waiting for server"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
