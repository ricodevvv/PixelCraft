import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { getDb, schema } from "./db";
import type { Locale } from "./i18n";

export type StoreSettings = {
  storeName: string;
  tagline: string;
  about: string;
  serverAddress: string;
  discordUrl: string;
  currency: string;
  locale: Locale;
  accentHue: number;
  monthlyGoal: number;
  requirePremium: boolean;
  checkInterval: number;
  announcement: string;
  discordWebhook: string;
};

export const defaultSettings: StoreSettings = {
  storeName: "PixelCraft",
  tagline: "Ranks, kits and cosmetics for your favorite server.",
  about: "Every purchase helps keep the server online. Thanks for the support!",
  serverAddress: "play.example.com",
  discordUrl: "",
  currency: "USD",
  locale: "en",
  accentHue: 145,
  monthlyGoal: 0,
  requirePremium: true,
  checkInterval: 30,
  announcement: "",
  discordWebhook: "",
};

/**
 * Reads every store setting from the database, filling the gaps with defaults.
 * Cached per request, so call it as often as you want.
 */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  await connection();
  return readSettings();
});

/**
 * Same as getSettings but without the request bits, for code that runs after the response.
 */
export async function readSettings(): Promise<StoreSettings> {
  const rows = await getDb().select().from(schema.settings);
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...defaultSettings, ...stored } as StoreSettings;
}

/**
 * Saves a partial set of settings, one row per key.
 */
export async function saveSettings(values: Partial<StoreSettings>) {
  const db = getDb();
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      await tx
        .insert(schema.settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
    }
  });
}
