import "server-only";
import { and, asc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "./db";
import type { Server } from "./db/schema";
import { toMajor } from "./money";

export type PluginOrder = {
  id: number;
  date: string;
  player: string;
  execution: "BUY" | "RECOVER" | "REFUND";
  items: { product: number | null; id: string; amount: number; price: number }[];
};

/**
 * Error body in the shape PixelBuy expects: { error, message, status }.
 */
export function pluginError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message, status }, { status });
}

function readSecret(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("secret");
  if (fromQuery) return fromQuery;

  const fromHeader = request.headers.get("secret") ?? request.headers.get("x-pixelbuy-secret");
  if (fromHeader) return fromHeader;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6).trim(), "base64").toString("utf8");
    if (!decoded.includes(":")) return decoded;
    const index = decoded.indexOf(":");
    return decoded.slice(index + 1) || decoded.slice(0, index);
  }
  return null;
}

/**
 * Finds the server that owns the secret sent by the plugin (query param, header or Basic auth).
 */
export async function authenticateServer(request: Request): Promise<Server | null> {
  const secret = readSecret(request);
  if (!secret) return null;
  const db = getDb();
  const [server] = await db.select().from(schema.servers).where(eq(schema.servers.secret, secret)).limit(1);
  if (!server) return null;

  const staleBefore = new Date(Date.now() - 15_000);
  await db
    .update(schema.servers)
    .set({ lastSeenAt: new Date() })
    .where(
      and(
        eq(schema.servers.id, server.id),
        or(isNull(schema.servers.lastSeenAt), lt(schema.servers.lastSeenAt, staleBefore)),
      ),
    );
  return server;
}

/**
 * Builds the PixelBuy order objects for a group, only with the items that belong to it.
 */
export async function serializeOrders(
  group: string,
  entries: { orderId: number; execution: PluginOrder["execution"] }[],
): Promise<PluginOrder[]> {
  if (entries.length === 0) return [];
  const db = getDb();
  const ids = entries.map((entry) => entry.orderId);
  const [orders, items] = await Promise.all([
    db.select().from(schema.orders).where(inArray(schema.orders.id, ids)),
    db
      .select()
      .from(schema.orderItems)
      .where(and(inArray(schema.orderItems.orderId, ids), eq(schema.orderItems.group, group))),
  ]);
  const byId = new Map(orders.map((order) => [order.id, order]));

  return entries.flatMap(({ orderId, execution }) => {
    const order = byId.get(orderId);
    if (!order) return [];
    const date = (order.paidAt ?? order.createdAt).toISOString().slice(0, 10);
    return [
      {
        id: order.id,
        date,
        player: order.playerUuid ? `${order.playerUuid}:${order.playerName}` : order.playerName,
        execution,
        items: items
          .filter((item) => item.orderId === orderId)
          .map((item) => ({
            product: item.productId,
            id: item.itemId,
            amount: item.quantity,
            price: toMajor(item.total, order.currency),
          })),
      },
    ];
  });
}

/**
 * The oldest pending delivery of every order for a group. One order shows up once,
 * a second execution (say a RECOVER) waits until the first one is processed.
 */
export async function pendingForGroup(group: string, limit = 50) {
  const rows = await getDb()
    .select({ orderId: schema.deliveries.orderId, execution: schema.deliveries.execution })
    .from(schema.deliveries)
    .where(and(eq(schema.deliveries.group, group), isNull(schema.deliveries.deliveredAt)))
    .orderBy(asc(schema.deliveries.createdAt), asc(schema.deliveries.id))
    .limit(limit * 3);

  const seen = new Set<number>();
  const result: typeof rows = [];
  for (const row of rows) {
    if (seen.has(row.orderId)) continue;
    seen.add(row.orderId);
    result.push(row);
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * Marks the oldest pending delivery of each order as done for a group.
 */
export async function markProcessed(group: string, orderIds: number[]): Promise<number> {
  const db = getDb();
  let count = 0;
  for (const orderId of new Set(orderIds)) {
    if (!Number.isInteger(orderId)) continue;
    const [next] = await db
      .select({ id: schema.deliveries.id })
      .from(schema.deliveries)
      .where(
        and(
          eq(schema.deliveries.group, group),
          eq(schema.deliveries.orderId, orderId),
          isNull(schema.deliveries.deliveredAt),
        ),
      )
      .orderBy(asc(schema.deliveries.createdAt), asc(schema.deliveries.id))
      .limit(1);
    if (!next) continue;
    await db.update(schema.deliveries).set({ deliveredAt: new Date() }).where(eq(schema.deliveries.id, next.id));
    count++;
  }
  return count;
}
