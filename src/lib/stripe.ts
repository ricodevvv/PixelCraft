import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  client ??= new Stripe(key, { appInfo: { name: "PixelCraft", url: "https://github.com/ricodevvv/pixelcraft" } });
  return client;
}
