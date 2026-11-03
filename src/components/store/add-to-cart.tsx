"use client";

import { useRef, useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { cart } from "@/lib/cart-store";
import type { CardProduct } from "./product-card";
import { useStore } from "./store-provider";
import { gsap } from "./gsap";

/**
 * Quantity picker and add button for the product page. The art flies to the cart.
 */
export function AddToCart({ product, artId }: { product: CardProduct; artId: string }) {
  const { dict, money, flyToCart, setCartOpen } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  function add() {
    cart.add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        image: product.image,
        maxQuantity: product.maxQuantity,
      },
      quantity,
    );
    const art = document.getElementById(artId);
    if (art) flyToCart(art);
    setAdded(true);
    gsap.fromTo(button.current, { scale: 0.9 }, { scale: 1, duration: 0.6, ease: "elastic.out(1.2, 0.4)" });
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {product.maxQuantity > 1 && (
        <div className="pixel-clip flex items-center bg-surface-2 p-1 [--step:4px]">
          <button type="button" className="btn btn-ghost btn-sm !p-2.5" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="-">
            <Minus className="size-4" />
          </button>
          <span className="font-pixel w-12 text-center text-xl" aria-label={dict.product.quantity}>
            {quantity}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm !p-2.5"
            onClick={() => setQuantity((q) => Math.min(product.maxQuantity, q + 1))}
            aria-label="+"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
      <button ref={button} type="button" onClick={add} className="btn btn-primary h-14 flex-1 text-lg sm:flex-none sm:px-8">
        {added ? <Check className="size-5" /> : <ShoppingBag className="size-5" />}
        {added ? dict.product.added : `${dict.product.add} · ${money(product.price * quantity)}`}
      </button>
      {added && (
        <button type="button" onClick={() => setCartOpen(true)} className="btn btn-ghost h-14">
          {dict.cart.checkout}
        </button>
      )}
    </div>
  );
}
