import "server-only";
import { SignJWT, jwtVerify } from "jose";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return new TextEncoder().encode(`subscription:${secret}`);
}

/**
 * Signed link that opens the Stripe portal for one subscription. It goes in receipts, so it doesn't expire.
 */
export async function subscriptionManageUrl(baseUrl: string, stripeSubscriptionId: string): Promise<string> {
  const token = await new SignJWT({ sub: stripeSubscriptionId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().sign(key());
  return `${baseUrl}/subscription/manage?token=${token}`;
}

export async function readSubscriptionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
