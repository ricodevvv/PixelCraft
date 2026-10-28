import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { authenticateServer, pluginError, serializeOrders } from "@/lib/plugin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const server = await authenticateServer(request);
  if (!server) return pluginError("unauthorized", "Invalid or missing secret", 401);

  const orderId = Number((await context.params).id);
  if (!Number.isInteger(orderId)) return pluginError("bad_request", "Order id must be a number", 400);

  const db = getDb();
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!order || order.status === "pending" || order.status === "cancelled") {
    return pluginError("not_found", `Order ${orderId} doesn't exist`, 404);
  }

  const [pending] = await db
    .select({ execution: schema.deliveries.execution })
    .from(schema.deliveries)
    .where(and(eq(schema.deliveries.orderId, orderId), eq(schema.deliveries.group, server.group), isNull(schema.deliveries.deliveredAt)))
    .orderBy(desc(schema.deliveries.createdAt))
    .limit(1);
  const execution = pending?.execution ?? (order.status === "refunded" ? "REFUND" : "BUY");

  const [serialized] = await serializeOrders(server.group, [{ orderId, execution }]);
  return NextResponse.json(serialized);
}
