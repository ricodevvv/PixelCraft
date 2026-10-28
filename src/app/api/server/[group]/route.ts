import { z } from "zod";
import { NextResponse } from "next/server";
import { authenticateServer, markProcessed, pendingForGroup, pluginError, serializeOrders } from "@/lib/plugin";
import { getSettings } from "@/lib/settings";

type Context = { params: Promise<{ group: string }> };

async function resolve(request: Request, context: Context) {
  const { group } = await context.params;
  const server = await authenticateServer(request);
  if (!server) return { error: pluginError("unauthorized", "Invalid or missing secret", 401) };
  if (server.group !== decodeURIComponent(group)) {
    return { error: pluginError("forbidden", `This secret belongs to the '${server.group}' group`, 403) };
  }
  return { server };
}

export async function GET(request: Request, context: Context) {
  const { server, error } = await resolve(request, context);
  if (error) return error;

  const pending = await pendingForGroup(server.group);
  const [orders, settings] = await Promise.all([serializeOrders(server.group, pending), getSettings()]);
  return NextResponse.json({ pending_orders: orders, next_check: settings.checkInterval });
}

const updateSchema = z.object({ processed_orders: z.array(z.number().int()).max(500).default([]) });

export async function POST(request: Request, context: Context) {
  const { server, error } = await resolve(request, context);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pluginError("bad_request", "Expected { processed_orders: number[] }", 400);

  const processed = await markProcessed(server.group, parsed.data.processed_orders);
  return NextResponse.json({ processed });
}
