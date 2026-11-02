import { z } from "zod";
import { NextResponse } from "next/server";
import { priceCart } from "@/lib/orders";

const bodySchema = z.object({
  lines: z.array(z.object({ productId: z.number().int(), quantity: z.number().int().min(1) })).max(50),
  coupon: z.string().max(64).optional().nullable(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const cart = await priceCart(parsed.data.lines, parsed.data.coupon);
  return NextResponse.json({
    lines: cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity, total: line.total })),
    subtotal: cart.subtotal,
    discount: cart.discount,
    total: cart.total,
    coupon: cart.coupon?.code ?? null,
    couponError: cart.couponError,
  });
}
