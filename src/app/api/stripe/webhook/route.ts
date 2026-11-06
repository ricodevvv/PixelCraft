import type Stripe from "stripe";
import { after, NextResponse } from "next/server";
import { notifyOrderPaid } from "@/lib/notify";
import { getBaseUrl } from "@/lib/url";
import { getStripe } from "@/lib/stripe";
import {
  cancelOrder,
  endSubscription,
  findOrderByPaymentIntent,
  markOrderPaid,
  recordRenewal,
  recordSubscription,
  refundOrder,
  updateSubscription,
} from "@/lib/orders";

function orderIdOf(session: Stripe.Checkout.Session): number | null {
  const id = Number(session.metadata?.orderId ?? session.client_reference_id);
  return Number.isInteger(id) ? id : null;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function periodEnd(subscription: Stripe.Subscription): Date | null {
  const end = subscription.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const orderId = orderIdOf(session);
      if (!orderId || session.payment_status === "unpaid") break;
      const subscriptionId = idOf(session.subscription);
      const paid = await markOrderPaid(orderId, {
        paymentIntent: idOf(session.payment_intent),
        email: session.customer_details?.email ?? null,
        subscriptionId,
      });
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await recordSubscription(orderId, subscriptionId, subscription.status, periodEnd(subscription));
      }
      if (paid) {
        const baseUrl = await getBaseUrl();
        after(() => notifyOrderPaid(orderId, baseUrl));
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
      const intent = idOf(charge.payment_intent);
      if (intent && charge.refunded) {
        const order = await findOrderByPaymentIntent(intent);
        if (order) await refundOrder(order.id);
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
      if (subscriptionId && invoice.id && invoice.billing_reason === "subscription_cycle") {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await recordRenewal(subscriptionId, invoice.id, invoice.amount_paid, periodEnd(subscription));
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      await updateSubscription(subscription.id, {
        status: subscription.status,
        currentPeriodEnd: periodEnd(subscription),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
      break;
    }
    case "customer.subscription.deleted": {
      await endSubscription(event.data.object.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
