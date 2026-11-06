import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { GiftCard, Order, OrderItem, Subscription } from "./db/schema";
import { getDictionary, type Dictionary } from "./i18n";
import { formatMoney } from "./money";
import { readSettings, type StoreSettings } from "./settings";
import { subscriptionManageUrl } from "./subscription-link";

type PaidOrder = Order & { items: OrderItem[]; giftCards: GiftCard[]; subscriptions: Subscription[] };

const DISCORD_HOSTS = new Set(["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"]);

/**
 * True when the URL looks like a real Discord webhook, so the store never posts anywhere else.
 */
export function isDiscordWebhook(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && DISCORD_HOSTS.has(parsed.hostname) && parsed.pathname.startsWith("/api/webhooks/");
  } catch {
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function accentRgb(hue: number): [number, number, number] {
  const s = 0.7;
  const l = 0.6;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((value) => Math.round(value * 255)) as [number, number, number];
}

function accentHex(hue: number): string {
  return `#${accentRgb(hue)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\*_~`|>#\[\]()])/g, "\\$1");
}

function avatarUrl(name: string): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name.replace(/^\./, ""))}/128`;
}

async function postDiscord(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Discord answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function postEmail(payload: { to: string; subject: string; html: string; text: string }, idempotencyKey?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

function discordEmbed(order: PaidOrder, settings: StoreSettings, dict: Dictionary, baseUrl: string) {
  const money = (amount: number) => formatMoney(amount, order.currency, settings.locale);
  const [r, g, b] = accentRgb(settings.accentHue);
  const fields = [
    { name: dict.notify.player, value: escapeMarkdown(order.playerName), inline: true },
    { name: dict.notify.total, value: money(order.total), inline: true },
    { name: dict.notify.order, value: `#${order.id}`, inline: true },
  ];
  if (order.giftFrom) fields.push({ name: dict.notify.giftFrom, value: escapeMarkdown(order.giftFrom), inline: true });
  if (order.giftCardAmount > 0) fields.push({ name: dict.notify.paidWithGiftCard, value: money(order.giftCardAmount), inline: true });
  if (order.discount > 0 && order.couponCode) {
    fields.push({ name: dict.notify.discount, value: `${escapeMarkdown(order.couponCode)} (-${money(order.discount)})`, inline: true });
  }
  return {
    username: settings.storeName,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: order.items.some((item) => item.kind === "subscription") ? dict.notify.newSubscription : dict.notify.newPurchase,
        url: baseUrl,
        color: (r << 16) | (g << 8) | b,
        description: order.items.map((item) => `**${item.quantity}×** ${escapeMarkdown(item.name)}`).join("\n"),
        thumbnail: { url: avatarUrl(order.playerName) },
        fields,
        footer: { text: settings.storeName },
        timestamp: (order.paidAt ?? new Date()).toISOString(),
      },
    ],
  };
}

function receiptEmail(order: PaidOrder, settings: StoreSettings, dict: Dictionary, baseUrl: string, manageUrl: string | null) {
  const money = (amount: number) => formatMoney(amount, order.currency, settings.locale);
  const accent = accentHex(settings.accentHue);
  const store = escapeHtml(settings.storeName);
  const subject = dict.notify.subject.replace("{id}", String(order.id)).replace("{store}", settings.storeName);
  const rows = order.items
    .map(
      (item) => `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #2b2740;color:#f2f0fb;">${item.quantity}× ${escapeHtml(item.name)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #2b2740;color:#9c97b6;text-align:right;font-family:Menlo,Consolas,monospace;">${money(item.unitPrice * item.quantity)}</td>
        </tr>`,
    )
    .join("");
  const discountRow =
    order.discount > 0
      ? `<tr>
          <td style="padding:6px 0;color:${accent};">${dict.notify.discount}${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}</td>
          <td style="padding:6px 0;color:${accent};text-align:right;font-family:Menlo,Consolas,monospace;">-${money(order.discount)}</td>
        </tr>`
      : "";
  const giftCardRow =
    order.giftCardAmount > 0
      ? `<tr>
          <td style="padding:6px 0;color:${accent};">${escapeHtml(dict.notify.paidWithGiftCard)}</td>
          <td style="padding:6px 0;color:${accent};text-align:right;font-family:Menlo,Consolas,monospace;">-${money(order.giftCardAmount)}</td>
        </tr>`
      : "";
  const giftLine = order.giftFrom
    ? `<p style="margin:10px 0 0;font-size:14px;color:#f2f0fb;">${escapeHtml(dict.notify.giftFrom)} <strong>${escapeHtml(order.giftFrom)}</strong> → <strong>${escapeHtml(order.playerName)}</strong></p>`
    : "";
  const codesBlock = order.giftCards.length
    ? `<div style="margin-top:24px;padding:16px;border:2px dashed ${accent};">
          <p style="margin:0 0 10px;font-size:12px;color:#9c97b6;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(dict.notify.codesTitle)}</p>
          ${order.giftCards
            .map(
              (card) =>
                `<p style="margin:6px 0;font-family:Menlo,Consolas,monospace;font-size:18px;color:#f2f0fb;letter-spacing:1px;">${escapeHtml(card.code)} <span style="color:${accent};font-size:14px;">${money(card.initialBalance)}</span></p>`,
            )
            .join("")}
        </div>`
    : "";
  const manageBlock = manageUrl
    ? `<p style="margin:20px 0 0;font-size:14px;"><a href="${escapeHtml(manageUrl)}" style="color:${accent};">${escapeHtml(dict.notify.manage)}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="${settings.locale}">
<body style="margin:0;padding:0;background:#07060d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07060d;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding:0 0 20px;font-size:22px;font-weight:700;color:#f2f0fb;letter-spacing:0.5px;">
          <span style="display:inline-block;width:12px;height:12px;background:${accent};margin-right:10px;"></span>${store}
        </td></tr>
        <tr><td style="background:#13111d;border:2px solid #2b2740;padding:28px;">
          <h1 style="margin:0;font-size:24px;line-height:1.25;color:#f2f0fb;">${escapeHtml(dict.notify.heading)}</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#9c97b6;">${escapeHtml(dict.notify.intro)}</p>
          ${giftLine}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;font-size:14px;">
            <tr>
              <td style="padding:0 0 12px;color:#67627f;text-transform:uppercase;letter-spacing:1px;font-size:11px;">${dict.notify.order} #${order.id}</td>
              <td style="padding:0 0 12px;color:#67627f;text-align:right;text-transform:uppercase;letter-spacing:1px;font-size:11px;">${dict.notify.player}: ${escapeHtml(order.playerName)}</td>
            </tr>
            ${rows}
            ${discountRow}
            ${giftCardRow}
            <tr>
              <td style="padding:14px 0 0;color:#f2f0fb;font-weight:700;font-size:16px;">${dict.notify.total}</td>
              <td style="padding:14px 0 0;color:${accent};text-align:right;font-weight:700;font-size:20px;font-family:Menlo,Consolas,monospace;">${money(order.total)}</td>
            </tr>
          </table>
          ${codesBlock}
          ${manageBlock}
          <a href="${escapeHtml(baseUrl)}" style="display:inline-block;margin-top:28px;background:${accent};color:#0b0a12;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;">${escapeHtml(dict.notify.visit)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    settings.storeName,
    "",
    dict.notify.heading,
    dict.notify.intro,
    "",
    `${dict.notify.order} #${order.id} · ${dict.notify.player}: ${order.playerName}`,
    ...order.items.map((item) => `${item.quantity}x ${item.name} - ${money(item.unitPrice * item.quantity)}`),
    ...(order.giftFrom ? [`${dict.notify.giftFrom}: ${order.giftFrom}`] : []),
    ...(order.discount > 0 ? [`${dict.notify.discount}: -${money(order.discount)}`] : []),
    ...(order.giftCardAmount > 0 ? [`${dict.notify.paidWithGiftCard}: -${money(order.giftCardAmount)}`] : []),
    `${dict.notify.total}: ${money(order.total)}`,
    ...(order.giftCards.length ? ["", dict.notify.codesTitle, ...order.giftCards.map((card) => `${card.code} (${money(card.initialBalance)})`)] : []),
    ...(manageUrl ? ["", `${dict.notify.manage}: ${manageUrl}`] : []),
    "",
    baseUrl,
  ].join("\n");

  return { subject, html, text };
}

/**
 * Tells everyone who cares that an order got paid: a Discord post and an email receipt.
 * Failures are logged and swallowed, a notification should never break a sale.
 */
export async function notifyOrderPaid(orderId: number, baseUrl: string) {
  const order = await getDb().query.orders.findFirst({
    where: eq(schema.orders.id, orderId),
    with: { items: true, giftCards: true, subscriptions: true },
  });
  if (!order || order.status !== "paid") return;
  const settings = await readSettings();
  const dict = getDictionary(settings.locale);

  const jobs: Promise<void>[] = [];
  if (settings.discordWebhook && isDiscordWebhook(settings.discordWebhook)) {
    jobs.push(postDiscord(settings.discordWebhook, discordEmbed(order, settings, dict, baseUrl)));
  }
  if (order.email && isEmailConfigured()) {
    const subscriptionId = order.stripeSubscriptionId ?? order.subscriptions[0]?.stripeSubscriptionId;
    const manageUrl = subscriptionId ? await subscriptionManageUrl(baseUrl, subscriptionId) : null;
    const email = receiptEmail(order, settings, dict, baseUrl, manageUrl);
    jobs.push(postEmail({ to: order.email, ...email }, `order-${order.id}-receipt`));
  }

  for (const result of await Promise.allSettled(jobs)) {
    if (result.status === "rejected") console.error(`Notification for order #${orderId} failed:`, result.reason);
  }
}

function sampleOrder(settings: StoreSettings): PaidOrder {
  const now = new Date();
  return {
    id: 0,
    playerName: "Notch",
    playerUuid: null,
    giftFrom: null,
    email: null,
    status: "paid",
    currency: settings.currency,
    subtotal: 499,
    discount: 0,
    total: 499,
    giftCardAmount: 0,
    couponCode: null,
    stripeSessionId: null,
    stripePaymentIntent: null,
    stripeSubscriptionId: null,
    stripeInvoiceId: null,
    renewalOf: null,
    createdAt: now,
    paidAt: now,
    items: [{ id: 0, orderId: 0, productId: null, name: "VIP", kind: "item", group: "survival", itemId: "rank-vip", quantity: 1, unitPrice: 499, total: 499 }],
    giftCards: [],
    subscriptions: [],
  };
}

/**
 * Posts a sample purchase to the saved Discord webhook, so admins can check the setup.
 */
export async function sendTestDiscord(baseUrl: string) {
  const settings = await readSettings();
  if (!settings.discordWebhook || !isDiscordWebhook(settings.discordWebhook)) throw new Error("Save a Discord webhook URL first.");
  const dict = getDictionary(settings.locale);
  const payload = discordEmbed(sampleOrder(settings), settings, dict, baseUrl);
  payload.embeds[0].footer = { text: `${settings.storeName} · ${dict.notify.test}` };
  await postDiscord(settings.discordWebhook, payload);
}

/**
 * Sends a sample receipt to an address, so admins can check the Resend setup and the look.
 */
export async function sendTestEmail(to: string, baseUrl: string) {
  const settings = await readSettings();
  const dict = getDictionary(settings.locale);
  const email = receiptEmail(sampleOrder(settings), settings, dict, baseUrl, null);
  await postEmail({ to, ...email, subject: `[Test] ${email.subject}` });
}
