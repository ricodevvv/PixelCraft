import { NextResponse } from "next/server";
import { rateLimitByIp } from "@/lib/rate-limit";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { readSubscriptionToken } from "@/lib/subscription-link";
import { getBaseUrl } from "@/lib/url";

export async function GET(request: Request) {
  if (!(await rateLimitByIp("manage", 20, 60)).allowed) {
    return new NextResponse("Too many requests, try again in a minute.", { status: 429 });
  }
  const token = new URL(request.url).searchParams.get("token");
  const subscriptionId = token ? await readSubscriptionToken(token) : null;
  if (!subscriptionId || !isStripeConfigured()) {
    return new NextResponse("This link isn't valid.", { status: 404 });
  }
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const portal = await stripe.billingPortal.sessions.create({ customer, return_url: await getBaseUrl() });
  return NextResponse.redirect(portal.url, 303);
}
