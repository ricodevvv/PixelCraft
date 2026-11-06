import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.mercadopago.com";

export type MpItem = { id: string; title: string; description?: string; quantity: number; unitPrice: number; pictureUrl?: string };

export type MpPayment = {
  id: number;
  status: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  payer?: { email?: string | null } | null;
};

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

async function call<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set.");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${API}${path}`, { ...init, headers, signal: AbortSignal.timeout(15000) });
  const body = await res.text();
  if (!res.ok) {
    let message = body.slice(0, 200);
    try {
      message = (JSON.parse(body) as { message?: string }).message ?? message;
    } catch {}
    throw new Error(`Mercado Pago answered ${res.status}: ${message}`);
  }
  return JSON.parse(body) as T;
}

/**
 * Creates a Checkout Pro preference and returns where to send the buyer.
 */
export async function createPreference(input: {
  orderId: number;
  items: MpItem[];
  currency: string;
  email?: string | null;
  baseUrl: string;
  successUrl: string;
}): Promise<{ id: string; url: string }> {
  const preference = await call<{ id: string; init_point: string }>("/checkout/preferences", {
    method: "POST",
    idempotencyKey: `order-${input.orderId}-preference`,
    body: JSON.stringify({
      items: input.items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        picture_url: item.pictureUrl,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        currency_id: input.currency,
      })),
      external_reference: String(input.orderId),
      metadata: { order_id: input.orderId },
      payer: input.email ? { email: input.email } : undefined,
      back_urls: { success: input.successUrl, pending: input.successUrl, failure: `${input.baseUrl}/checkout/cancel` },
      auto_return: "approved",
      notification_url: `${input.baseUrl}/api/mercadopago/webhook`,
    }),
  });
  return { id: preference.id, url: preference.init_point };
}

export async function getPayment(id: string): Promise<MpPayment> {
  return call<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`);
}

export async function refundPayment(id: string) {
  await call(`/v1/payments/${encodeURIComponent(id)}/refunds`, { method: "POST", idempotencyKey: `refund-${id}`, body: "{}" });
}

/**
 * Checks the x-signature header Mercado Pago sends when a webhook secret is set up.
 * Without MERCADOPAGO_WEBHOOK_SECRET it returns true: the payment is always re-read from the API anyway.
 */
export function verifyWebhookSignature(headers: Headers, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true;
  const signature = headers.get("x-signature") ?? "";
  const requestId = headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key.trim(), rest.join("=").trim()];
    }),
  );
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
