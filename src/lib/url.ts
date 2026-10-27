import "server-only";
import { headers } from "next/headers";

/**
 * Public base URL of the store. Uses APP_URL when set, otherwise the request host.
 */
export async function getBaseUrl(): Promise<string> {
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
