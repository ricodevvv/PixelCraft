import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { lt, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfter: number };

/**
 * The visitor's IP as the platform reports it. Vercel and most proxies put the real one first.
 */
export async function clientIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip") || "unknown";
}

function bucketKey(scope: string, id: string) {
  return `${scope}:${createHash("sha256").update(id).digest("base64url").slice(0, 22)}`;
}

/**
 * Counts one hit for scope + id and says if it's still under the limit for the window.
 * Lives in Postgres, so it works the same on Vercel, Docker or several instances at once.
 */
export async function rateLimit(scope: string, id: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const db = getDb();
  const key = bucketKey(scope, id);
  const window = sql`now() + make_interval(secs => ${windowSeconds})`;
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, count: 1, resetAt: sql`${window}` })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: {
        count: sql`case when ${schema.rateLimits.resetAt} <= now() then 1 else ${schema.rateLimits.count} + 1 end`,
        resetAt: sql`case when ${schema.rateLimits.resetAt} <= now() then ${window} else ${schema.rateLimits.resetAt} end`,
      },
    })
    .returning({ count: schema.rateLimits.count, resetAt: schema.rateLimits.resetAt });

  if (Math.random() < 0.02) {
    await db.delete(schema.rateLimits).where(lt(schema.rateLimits.resetAt, sql`now()`));
  }

  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    retryAfter: Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)),
  };
}

/**
 * Same as rateLimit, keyed by the caller's IP.
 */
export async function rateLimitByIp(scope: string, limit: number, windowSeconds: number) {
  return rateLimit(scope, await clientIp(), limit, windowSeconds);
}

/**
 * Wipes a bucket, used after a successful login so a typo or two don't linger.
 */
export async function resetRateLimit(scope: string, id: string) {
  await getDb().delete(schema.rateLimits).where(sql`${schema.rateLimits.key} = ${bucketKey(scope, id)}`);
}
