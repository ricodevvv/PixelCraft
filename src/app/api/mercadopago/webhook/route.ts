import { after, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getPayment, isMercadoPagoConfigured, verifyWebhookSignature } from "@/lib/mercadopago";
import { toMajor } from "@/lib/money";
import { notifyOrderPaid } from "@/lib/notify";
import { cancelOrder, markOrderPaid, refundOrder } from "@/lib/orders";
import { getBaseUrl } from "@/lib/url";

/**
 * Mercado Pago payment notifications. The body is never trusted: the payment is read again from
 * the API and has to match the order's amount and currency before anything changes.
 */
export async function POST(request: Request) {
  if (!isMercadoPagoConfigured()) return NextResponse.json({ error: "Mercado Pago not configured" }, { status: 400 });

  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? body.topic;
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? (body.data?.id !== undefined ? String(body.data.id) : null);
  if (type !== "payment" || !dataId) return NextResponse.json({ ignored: true });
  if (!verifyWebhookSignature(request.headers, dataId)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payment = await getPayment(dataId);
  const orderId = Number(payment.external_reference);
  if (!Number.isInteger(orderId)) return NextResponse.json({ ignored: true });
  const [order] = await getDb().select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!order || order.paymentProvider !== "mercadopago") return NextResponse.json({ ignored: true });

  const due = toMajor(order.total - order.giftCardAmount, order.currency);
  const matches = payment.currency_id?.toUpperCase() === order.currency && Math.abs(payment.transaction_amount - due) < 0.01;

  if (payment.status === "approved") {
    if (!matches) {
      console.error(`Mercado Pago payment ${payment.id} doesn't match order #${orderId}, ignoring it.`);
      return NextResponse.json({ ignored: true });
    }
    if (await markOrderPaid(orderId, { mpPaymentId: String(payment.id), email: payment.payer?.email ?? null })) {
      const baseUrl = await getBaseUrl();
      after(() => notifyOrderPaid(orderId, baseUrl));
    }
  } else if (payment.status === "cancelled") {
    await cancelOrder(orderId);
  } else if ((payment.status === "refunded" || payment.status === "charged_back") && order.mpPaymentId === String(payment.id)) {
    await refundOrder(orderId);
  }

  return NextResponse.json({ received: true });
}
