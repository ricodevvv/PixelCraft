import { NextResponse } from "next/server";
import { pingServer, type ServerStatus } from "@/lib/ping";
import { getSettings } from "@/lib/settings";

let cached: { address: string; at: number; status: ServerStatus } | null = null;

export async function GET() {
  const { serverAddress } = await getSettings();
  if (!cached || cached.address !== serverAddress || Date.now() - cached.at > 30_000) {
    cached = { address: serverAddress, at: Date.now(), status: await pingServer(serverAddress) };
  }
  return NextResponse.json(cached.status, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
