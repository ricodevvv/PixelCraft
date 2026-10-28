import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { cancelOrder, findOrderByPaymentIntent, markOrderPaid, refundOrder } from "@/lib/orders";

function orderIdOf(session: Stripe.Checkout.Session): number | null {
  const id = Number(session.metadata?.orderId ?? session.client_reference_id);
  return Number.isInteger(id) ? id : null;
}

function intentOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const orderId = orderIdOf(session);
      if (orderId && session.payment_status !== "unpaid") {
        await markOrderPaid(orderId, intentOf(session.payment_intent));
      }
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const orderId = orderIdOf(event.data.object);
      if (orderId) await cancelOrder(orderId);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const intent = intentOf(charge.payment_intent);
      if (intent && charge.refunded) {
        const order = await findOrderByPaymentIntent(intent);
        if (order) await refundOrder(order.id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
