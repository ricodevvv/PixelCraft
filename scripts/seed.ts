import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

const categories = [
  { slug: "ranks", name: "Ranks", description: "Perks, prefixes and bragging rights.", sort: 0 },
  { slug: "kits", name: "Kits", description: "Gear up and jump right into the action.", sort: 1 },
  { slug: "cosmetics", name: "Cosmetics", description: "Hats, trails and pets. Look good doing it.", sort: 2 },
  { slug: "economy", name: "Economy", description: "Coins and boosters for the server economy.", sort: 3 },
];

const products = [
  { slug: "vip", name: "VIP", tagline: "Colored name, /fly in the lobby and 2 homes.", price: 499, category: "ranks", itemId: "rank-vip", featured: true },
  { slug: "mvp", name: "MVP", tagline: "Everything in VIP plus /nick and 5 homes.", price: 999, comparePrice: 1299, category: "ranks", itemId: "rank-mvp", featured: true },
  { slug: "legend", name: "Legend", tagline: "The top rank. Custom prefix and priority queue.", price: 1999, category: "ranks", itemId: "rank-legend", featured: true },
  { slug: "super-pickaxe", name: "Super Pickaxe", tagline: "Efficiency V, Fortune XX. Mines like crazy.", price: 249, category: "kits", itemId: "super-pickaxe", featured: true, maxQuantity: 5 },
  { slug: "warrior-kit", name: "Warrior Kit", tagline: "Full diamond armor and a sharp sword.", price: 399, category: "kits", itemId: "kit-warrior" },
  { slug: "builder-kit", name: "Builder Kit", tagline: "Stacks of blocks for your next build.", price: 299, category: "kits", itemId: "kit-builder", maxQuantity: 10 },
  { slug: "flame-trail", name: "Flame Trail", tagline: "Leave a trail of fire wherever you walk.", price: 199, category: "cosmetics", itemId: "trail-flame", featured: true },
  { slug: "pet-dragon", name: "Pet Dragon", tagline: "A tiny dragon that follows you around.", price: 599, category: "cosmetics", itemId: "pet-dragon", featured: true },
  { slug: "crown-hat", name: "Crown Hat", tagline: "Because you're royalty.", price: 149, category: "cosmetics", itemId: "hat-crown" },
  { slug: "coins-1000", name: "1,000 Coins", tagline: "A quick boost for your wallet.", price: 199, category: "economy", itemId: "eco-bundle", featured: true, maxQuantity: 20 },
  { slug: "vip-plus-monthly", name: "VIP+ Monthly", tagline: "All VIP perks plus a monthly crate. Cancel anytime.", price: 399, category: "ranks", itemId: "rank-vip", featured: true, kind: "subscription" as const, interval: "month" as const },
  { slug: "gift-card-10", name: "Gift Card $10", tagline: "A code worth $10 to spend in the store or give to a friend.", price: 1000, category: "economy", itemId: "", featured: true, kind: "giftcard" as const, maxQuantity: 5 },
  { slug: "xp-booster", name: "XP Booster", tagline: "Double XP for the whole server, 1 hour.", price: 349, category: "economy", itemId: "booster-xp", featured: true, maxQuantity: 5 },
];

async function main() {
  const inserted = await db
    .insert(schema.categories)
    .values(categories)
    .onConflictDoNothing()
    .returning();
  const all = inserted.length ? inserted : await db.select().from(schema.categories);
  const bySlug = new Map(all.map((category) => [category.slug, category.id]));

  await db
    .insert(schema.products)
    .values(
      products.map(({ category, ...product }, index) => ({
        ...product,
        description: `${product.tagline}\n\nDelivered automatically by PixelBuy as soon as you're online.`,
        categoryId: bySlug.get(category) ?? null,
        group: "kind" in product && product.kind === "giftcard" ? "" : "survival",
        sort: index,
      })),
    )
    .onConflictDoNothing();

  const existing = await db.select().from(schema.servers);
  if (existing.length === 0) {
    const secret = randomBytes(24).toString("base64url");
    await db.insert(schema.servers).values({ name: "Survival", group: "survival", secret });
    console.log(`Created server "Survival" with secret: ${secret}`);
  }

  await db
    .insert(schema.coupons)
    .values({ code: "WELCOME10", type: "percent", value: 10 })
    .onConflictDoNothing();

  console.log("Seed done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
