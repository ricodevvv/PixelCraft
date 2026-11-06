import { z } from "zod";
import { NextResponse } from "next/server";
import { priceCart } from "@/lib/orders";
import { rateLimitByIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";

const bodySchema = z.object({
  lines: z.array(z.object({ productId: z.number().int(), quantity: z.number().int().min(1) })).max(50),
  coupon: z.string().max(64).optional().nullable(),
  giftCard: z.string().max(64).optional().nullable(),
});

export async function POST(request: Request) {
  const limit = await rateLimitByIp("cart", 60, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { currency } = await getSettings();
  const cart = await priceCart(parsed.data.lines, parsed.data.coupon, parsed.data.giftCard, currency);
  return NextResponse.json({
    lines: cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity, total: line.total })),
    subtotal: cart.subtotal,
    discount: cart.discount,
    total: cart.total,
    coupon: cart.coupon?.code ?? null,
    couponError: cart.couponError,
    giftCardAmount: cart.giftCardAmount,
    giftCardError: cart.giftCardError,
    due: cart.due,
    cartError: cart.cartError,
  });
}
