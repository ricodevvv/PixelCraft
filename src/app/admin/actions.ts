"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkPassword, createSession, destroySession, requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { locales } from "@/lib/i18n";
import { toMinor } from "@/lib/money";
import { isDiscordWebhook, isEmailConfigured, notifyOrderPaid, sendTestDiscord, sendTestEmail } from "@/lib/notify";
import { cancelOrder, endSubscription, markOrderPaid, newGiftCode, normalizeGiftCode, recoverOrder, refundOrder } from "@/lib/orders";
import { getSettings, saveSettings } from "@/lib/settings";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { isStorageConfigured, uploadFile } from "@/lib/storage";
import { getBaseUrl } from "@/lib/url";

export type FormState = { error?: string; ok?: string } | null;

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slugs use lowercase letters, numbers and dashes");
const optionalUrl = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.url().nullable());
const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());
const groupName = z.string().trim().min(1, "Group is required").max(64).regex(/^[A-Za-z0-9_.-]+$/, "Groups use letters, numbers, dots, dashes or underscores");

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".") || "Field"}: ${issue.message}` : "Invalid form";
}

function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string }; code?: string }) ?? {};
  return cause.code === "23505" || cause.cause?.code === "23505";
}

function refreshStore() {
  revalidatePath("/", "layout");
}

export async function login(_state: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (!process.env.ADMIN_PASSWORD) return { error: "Set ADMIN_PASSWORD in your environment first." };
  const ip = await clientIp();
  const limit = await rateLimit("login", ip, 5, 15 * 60);
  if (!limit.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} min.` };
  }
  if (!checkPassword(password)) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: "Wrong password." };
  }
  await resetRateLimit("login", ip);
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

async function productInput(form: FormData) {
  const { currency } = await getSettings();
  const money = z.coerce.number().min(0).transform((value) => toMinor(value, currency));
  return z
    .object({
      name: z.string().trim().min(1, "Name is required").max(80),
      slug,
      tagline: z.string().trim().max(160),
      description: z.string().trim().max(5000),
      image: optionalUrl,
      price: money,
      comparePrice: z
        .string()
        .trim()
        .transform((value) => (value === "" ? null : toMinor(Number(value), currency)))
        .pipe(z.number().int().min(0, "Compare price must be a positive number").nullable()),
      categoryId: z
        .string()
        .transform((value) => (value ? Number(value) : null))
        .pipe(z.number().int().nullable()),
      kind: z.enum(["item", "subscription", "giftcard"]).default("item"),
      interval: z.enum(["month", "year"]).default("month"),
      group: z.string().trim().max(64),
      itemId: z.string().trim().max(120),
      maxQuantity: z.coerce.number().int().min(1).max(999),
      sort: z.coerce.number().int(),
      featured: checkbox,
      active: checkbox,
    })
    .superRefine((value, ctx) => {
      if (value.kind !== "giftcard") {
        if (!groupName.safeParse(value.group).success) {
          ctx.addIssue({ code: "custom", path: ["group"], message: "Server group is required, letters, numbers, dots, dashes or underscores" });
        }
        if (!value.itemId) ctx.addIssue({ code: "custom", path: ["itemId"], message: "PixelBuy item id is required" });
      }
      if (value.kind !== "item" && value.price <= 0) {
        ctx.addIssue({ code: "custom", path: ["price"], message: "Subscriptions and gift cards need a price above zero" });
      }
    })
    .transform((value) => ({
      ...value,
      interval: value.kind === "subscription" ? value.interval : null,
      group: value.kind === "giftcard" ? "" : value.group,
      itemId: value.kind === "giftcard" ? "" : value.itemId,
      maxQuantity: value.kind === "subscription" ? 1 : value.maxQuantity,
    }))
    .safeParse(Object.fromEntries(form));
}

export async function saveProduct(_state: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(form.get("id"));
  form.delete("id");
  const parsed = await productInput(form);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const db = getDb();
  try {
    if (id) {
      await db.update(schema.products).set(parsed.data).where(eq(schema.products.id, id));
    } else {
      await db.insert(schema.products).values(parsed.data);
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Another product already uses that slug." };
    throw error;
  }
  refreshStore();
  redirect("/admin/products");
}

export async function deleteProduct(form: FormData) {
  await requireAdmin();
  await getDb().delete(schema.products).where(eq(schema.products.id, Number(form.get("id"))));
  refreshStore();
  redirect("/admin/products");
}

export async function saveCategory(_state: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(form.get("id"));
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Name is required").max(60),
      slug,
      description: z.string().trim().max(300),
      image: optionalUrl,
      sort: z.coerce.number().int(),
    })
    .safeParse({
      name: form.get("name"),
      slug: form.get("slug"),
      description: form.get("description") ?? "",
      image: form.get("image") ?? "",
      sort: form.get("sort") ?? 0,
    });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const db = getDb();
  try {
    if (id) {
      await db.update(schema.categories).set(parsed.data).where(eq(schema.categories.id, id));
    } else {
      await db.insert(schema.categories).values(parsed.data);
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Another category already uses that slug." };
    throw error;
  }
  refreshStore();
  redirect("/admin/categories");
}

export async function deleteCategory(form: FormData) {
  await requireAdmin();
  await getDb().delete(schema.categories).where(eq(schema.categories.id, Number(form.get("id"))));
  refreshStore();
  redirect("/admin/categories");
}

export async function createCoupon(_state: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const { currency } = await getSettings();
  const parsed = z
    .object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9_-]{3,32}$/, "Codes are 3-32 letters, numbers, dashes or underscores"),
      type: z.enum(["percent", "fixed"]),
      value: z.coerce.number().positive("Value must be above zero"),
      maxUses: z
        .string()
        .transform((value) => (value ? Number(value) : null))
        .pipe(z.number().int().positive().nullable()),
      expiresAt: z
        .string()
        .transform((value) => (value ? new Date(value) : null))
        .pipe(z.date().nullable()),
    })
    .safeParse({
      code: form.get("code"),
      type: form.get("type"),
      value: form.get("value"),
      maxUses: form.get("maxUses") ?? "",
      expiresAt: form.get("expiresAt") ?? "",
    });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { value, type, ...rest } = parsed.data;
  if (type === "percent" && value > 100) return { error: "A percent coupon can't go above 100." };

  try {
    await getDb()
      .insert(schema.coupons)
      .values({ ...rest, type, value: type === "percent" ? Math.round(value) : toMinor(value, currency) });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "That code already exists." };
    throw error;
  }
  revalidatePath("/admin/coupons");
  return { ok: `Coupon ${rest.code} created.` };
}

export async function toggleCoupon(form: FormData) {
  await requireAdmin();
  await getDb()
    .update(schema.coupons)
    .set({ active: form.get("active") === "true" })
    .where(eq(schema.coupons.id, Number(form.get("id"))));
  revalidatePath("/admin/coupons");
}

export async function deleteCoupon(form: FormData) {
  await requireAdmin();
  await getDb().delete(schema.coupons).where(eq(schema.coupons.id, Number(form.get("id"))));
  revalidatePath("/admin/coupons");
}

function newSecret() {
  return randomBytes(24).toString("base64url");
}

export async function createServer(_state: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = z
    .object({ name: z.string().trim().min(1, "Name is required").max(60), group: groupName })
    .safeParse({ name: form.get("name"), group: form.get("group") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await getDb().insert(schema.servers).values({ ...parsed.data, secret: newSecret() });
  revalidatePath("/admin/servers");
  return { ok: `Server ${parsed.data.name} added. Copy its config below.` };
}

export async function rotateServerSecret(form: FormData) {
  await requireAdmin();
  await getDb()
    .update(schema.servers)
    .set({ secret: newSecret() })
    .where(eq(schema.servers.id, Number(form.get("id"))));
  revalidatePath("/admin/servers");
}

export async function deleteServer(form: FormData) {
  await requireAdmin();
  await getDb().delete(schema.servers).where(eq(schema.servers.id, Number(form.get("id"))));
  revalidatePath("/admin/servers");
}

export async function updateSettings(_state: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const current = await getSettings();
  const parsed = z
    .object({
      storeName: z.string().trim().min(1).max(40),
      tagline: z.string().trim().max(200),
      about: z.string().trim().max(500),
      announcement: z.string().trim().max(160),
      serverAddress: z.string().trim().max(120),
      discordUrl: z.union([z.literal(""), z.url()]),
      discordWebhook: z
        .string()
        .trim()
        .refine((value) => value === "" || isDiscordWebhook(value), "Paste a Discord webhook URL (https://discord.com/api/webhooks/...)"),
      currency: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, "Use a 3 letter ISO currency like USD, EUR or MXN"),
      locale: z.enum(locales),
      accentHue: z.coerce.number().int().min(0).max(360),
      monthlyGoal: z.coerce.number().min(0),
      checkInterval: z.coerce.number().int().min(5).max(3600),
      requirePremium: checkbox,
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const currency = parsed.data.currency;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency });
  } catch {
    return { error: `${currency} isn't a currency this runtime knows.` };
  }

  await saveSettings({ ...parsed.data, monthlyGoal: toMinor(parsed.data.monthlyGoal, currency) });
  refreshStore();
  return {
    ok:
      currency !== current.currency
        ? "Saved. Heads up: product prices are stored as numbers, double check them after a currency change."
        : "Settings saved.",
  };
}

export async function orderAction(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const action = String(form.get("action"));

  if (action === "recover") {
    await recoverOrder(id);
  } else if (action === "mark-paid") {
    if (await markOrderPaid(id)) {
      const baseUrl = await getBaseUrl();
      after(() => notifyOrderPaid(id, baseUrl));
    }
  } else if (action === "cancel") {
    await cancelOrder(id);
  } else if (action === "cancel-subscription") {
    const [order] = await getDb().select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
    if (order?.stripeSubscriptionId) {
      await cancelStripeSubscription(order.stripeSubscriptionId);
      await endSubscription(order.stripeSubscriptionId);
    }
  } else if (action === "refund") {
    const [order] = await getDb().select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
    if (order?.stripeSubscriptionId) await cancelStripeSubscription(order.stripeSubscriptionId);
    if (order?.stripePaymentIntent && isStripeConfigured()) {
      try {
        await getStripe().refunds.create({ payment_intent: order.stripePaymentIntent });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "charge_already_refunded") throw error;
      }
    }
    await refundOrder(id);
    if (order?.stripeSubscriptionId) await endSubscription(order.stripeSubscriptionId);
  }
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
}

export async function testDiscord(): Promise<FormState> {
  await requireAdmin();
  try {
    await sendTestDiscord(await getBaseUrl());
    return { ok: "Test message sent. Check your Discord channel." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't reach Discord." };
  }
}

export async function testEmail(_state: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  if (!isEmailConfigured()) return { error: "Set RESEND_API_KEY (and EMAIL_FROM) in your environment first." };
  const parsed = z.email().safeParse(String(form.get("to") ?? "").trim());
  if (!parsed.success) return { error: "Type a valid email address." };
  try {
    await sendTestEmail(parsed.data, await getBaseUrl());
    return { ok: `Test receipt sent to ${parsed.data}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't reach Resend." };
  }
}


export async function createSale(_state: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Give the sale a name").max(60),
      percent: z.coerce.number().int().min(1, "Discount must be at least 1%").max(90, "Keep it at 90% or less"),
      scope: z.string(),
      startsAt: z.iso.datetime({ offset: true, message: "Pick a start date" }),
      endsAt: z.iso.datetime({ offset: true, message: "Pick an end date" }),
    })
    .safeParse({
      name: form.get("name"),
      percent: form.get("percent"),
      scope: form.get("scope") ?? "all",
      startsAt: form.get("startsAt"),
      endsAt: form.get("endsAt"),
    });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (endsAt <= startsAt) return { error: "The sale has to end after it starts." };
  if (endsAt <= new Date()) return { error: "That end date already passed." };
  const categoryId = parsed.data.scope === "all" ? null : Number(parsed.data.scope);
  if (categoryId !== null && !Number.isInteger(categoryId)) return { error: "Pick a category or the whole store." };

  await getDb().insert(schema.sales).values({ name: parsed.data.name, percent: parsed.data.percent, categoryId, startsAt, endsAt });
  refreshStore();
  revalidatePath("/admin/sales");
  return { ok: `${parsed.data.name} saved.` };
}

export async function toggleSale(form: FormData) {
  await requireAdmin();
  await getDb()
    .update(schema.sales)
    .set({ active: form.get("active") === "true" })
    .where(eq(schema.sales.id, Number(form.get("id"))));
  refreshStore();
  revalidatePath("/admin/sales");
}

export async function deleteSale(form: FormData) {
  await requireAdmin();
  await getDb().delete(schema.sales).where(eq(schema.sales.id, Number(form.get("id"))));
  refreshStore();
  revalidatePath("/admin/sales");
}


async function cancelStripeSubscription(subscriptionId: string) {
  if (!isStripeConfigured()) return;
  try {
    await getStripe().subscriptions.cancel(subscriptionId);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "resource_missing") throw error;
  }
}

export async function createGiftCard(_state: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const { currency } = await getSettings();
  const parsed = z
    .object({
      amount: z.coerce.number().positive("Amount must be above zero"),
      code: z
        .string()
        .transform((value) => normalizeGiftCode(value))
        .pipe(z.string().regex(/^$|^[A-Z0-9-]{6,40}$/, "Codes are 6-40 letters, numbers or dashes")),
    })
    .safeParse({ amount: form.get("amount"), code: form.get("code") ?? "" });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const balance = toMinor(parsed.data.amount, currency);
  const code = parsed.data.code || newGiftCode();
  try {
    await getDb().insert(schema.giftCards).values({ code, initialBalance: balance, balance, currency: currency.toUpperCase() });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "That code already exists." };
    throw error;
  }
  revalidatePath("/admin/gift-cards");
  return { ok: `Gift card ${code} created.` };
}

export async function toggleGiftCard(form: FormData) {
  await requireAdmin();
  await getDb()
    .update(schema.giftCards)
    .set({ active: form.get("active") === "true" })
    .where(eq(schema.giftCards.id, Number(form.get("id"))));
  revalidatePath("/admin/gift-cards");
}

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function uploadImage(form: FormData): Promise<{ url: string } | { error: string }> {
  await requireAdmin();
  if (!isStorageConfigured()) return { error: "Uploads need an S3 bucket (S3_BUCKET and keys). Paste an image URL instead." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Pick an image first." };
  const extension = IMAGE_TYPES[file.type];
  if (!extension) return { error: "Use a PNG, JPG, WebP or GIF image." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "Images can be up to 4 MB." };
  const folder = form.get("folder") === "categories" ? "categories" : "products";
  try {
    return { url: await uploadFile(folder, extension, await file.arrayBuffer(), file.type) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Upload failed." };
  }
}
