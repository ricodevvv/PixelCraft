"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { cart } from "@/lib/cart-store";
import { useStore } from "./store-provider";
import { gsap, prefersReducedMotion } from "./gsap";
import { ItemImage } from "@/components/ui/item-image";

export type CardProduct = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  image: string | null;
  price: number;
  comparePrice: number | null;
  maxQuantity: number;
  sale?: { name: string; percent: number; endsAt: string } | null;
  kind?: "item" | "subscription" | "giftcard";
  interval?: "month" | "year" | null;
};

/**
 * "/mo" or "/yr" after a subscription price, nothing for one-time products.
 */
export function intervalSuffix(product: Pick<CardProduct, "kind" | "interval">, labels: { perMonth: string; perYear: string }) {
  if (product.kind !== "subscription") return "";
  return product.interval === "year" ? labels.perYear : labels.perMonth;
}

/**
 * Store item card with a 3D tilt that follows the cursor and a fly-to-cart button.
 */
export function ProductCard({ product }: { product: CardProduct }) {
  const { dict, money, flyToCart } = useStore();
  const card = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const [added, setAdded] = useState(false);
  const onSale = product.comparePrice !== null && product.comparePrice > product.price;

  function onMove(event: React.PointerEvent) {
    if (prefersReducedMotion() || event.pointerType !== "mouse" || !card.current) return;
    const rect = card.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    gsap.to(card.current, { rotationY: px * 14, rotationX: -py * 14, duration: 0.5, ease: "power3.out", transformPerspective: 800 });
    gsap.to(art.current, { x: px * 18, y: py * 18, duration: 0.6, ease: "power3.out" });
    card.current.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
    card.current.style.setProperty("--my", `${(py + 0.5) * 100}%`);
  }

  function onLeave() {
    gsap.to(card.current, { rotationY: 0, rotationX: 0, duration: 0.9, ease: "elastic.out(1, 0.5)" });
    gsap.to(art.current, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.5)" });
  }

  function onEnter() {
    gsap.fromTo(art.current, { rotation: -6 }, { rotation: 0, scale: 1.08, duration: 0.5, ease: "back.out(3)" });
  }

  function add(event: React.MouseEvent) {
    event.preventDefault();
    cart.add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        image: product.image,
        maxQuantity: product.kind === "subscription" ? 1 : product.maxQuantity,
        interval: product.kind === "subscription" ? product.interval ?? "month" : null,
      },
      1,
    );
    if (art.current) flyToCart(art.current);
    setAdded(true);
    gsap.fromTo(event.currentTarget, { scale: 0.85 }, { scale: 1, duration: 0.5, ease: "elastic.out(1.2, 0.4)" });
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div
      ref={card}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerEnter={onEnter}
      className="product-card group relative [transform-style:preserve-3d]"
      data-reveal
    >
      <Link
        href={`/product/${product.slug}`}
        className="pixel-clip pixel-frame flex h-full flex-col p-2.5 [--step:6px] hover:[--frame:var(--accent-deep)] sm:p-4"
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(400px_circle_at_var(--mx,50%)_var(--my,50%),color-mix(in_oklch,var(--accent)_14%,transparent),transparent_60%)]" />
        <div className="slot pixel-clip relative grid aspect-square place-items-center overflow-hidden [--step:5px]">
          <div className="grid-bg absolute inset-0 opacity-50" />
          <div ref={art} className="relative size-[58%] will-change-transform">
            <ItemImage src={product.image} seed={product.slug} className="size-full object-contain drop-shadow-[0_10px_20px_rgb(0_0_0/0.5)]" spriteClassName="size-full drop-shadow-[0_10px_20px_rgb(0_0_0/0.5)]" />
          </div>
          {onSale && (
            <span className="badge absolute top-3 left-3 bg-accent-2 text-white">
              {product.sale ? `-${product.sale.percent}%` : dict.product.sale}
            </span>
          )}
        </div>
        <div className="relative mt-3 flex flex-1 flex-col px-1 sm:mt-4 sm:px-0">
          <h3 className="font-pixel text-lg leading-tight sm:text-xl">{product.name}</h3>
          {product.tagline && <p className="mt-1 line-clamp-2 text-xs text-muted sm:text-sm">{product.tagline}</p>}
          <div className="mt-auto flex items-end justify-between gap-2 pt-3 sm:pt-4">
            <div className="leading-none">
              {onSale && (
                <span className="block font-mono text-xs text-faint line-through">{money(product.comparePrice!)}</span>
              )}
              <span className="font-pixel text-xl text-accent sm:text-2xl">
                {money(product.price)}
                <span className="text-sm text-muted">{intervalSuffix(product, dict.product)}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={add}
              className="btn btn-primary btn-sm"
              aria-label={`${dict.product.add}: ${product.name}`}
            >
              {added ? <Check className="size-4" /> : <Plus className="size-4" />}
              <span className="hidden sm:inline">{added ? dict.product.added : dict.product.add}</span>
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}
