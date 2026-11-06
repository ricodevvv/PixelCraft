import { NextResponse } from "next/server";
import { resolvePlayer } from "@/lib/mojang";
import { rateLimitByIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const limit = await rateLimitByIp("player", 30, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  const { name } = await context.params;
  const player = await resolvePlayer(decodeURIComponent(name));
  if (!player) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const settings = await getSettings();
  const isBedrock = player.name.startsWith(".");
  if (settings.requirePremium && !player.premium && !isBedrock) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(player);
}
