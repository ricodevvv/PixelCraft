"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Minus, Plus, Tag, Trash2, X } from "lucide-react";
import { checkout } from "@/app/actions";
import { cart, useCart } from "@/lib/cart-store";
import type { Dictionary } from "@/lib/i18n";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { PlayerAvatar } from "./player-avatar";
import { lockScroll } from "./smooth-scroll";
import { useStore } from "./store-provider";
import { gsap, useGSAP } from "./gsap";

type Quote = {
  lines: { productId: number; quantity: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  coupon: string | null;
  couponError: string | null;
};

function errorText(dict: Dictionary, code: string) {
  return (dict.errors as Record<string, string>)[code] ?? dict.errors.generic;
}

export function CartDrawer() {
  const { dict, money, cartOpen, setCartOpen, setUserOpen } = useStore();
  const { items, player, coupon } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [couponInput, setCouponInput] = useState(coupon);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline>(null);

  const localSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartKey = items.map((item) => `${item.productId}x${item.quantity}`).join(",");

  useGSAP(
    () => {
      timeline.current = gsap
        .timeline({ paused: true })
        .set(root.current, { visibility: "visible" })
        .fromTo(".drawer-backdrop", { opacity: 0 }, { opacity: 1, duration: 0.3 })
        .fromTo(
          ".drawer-panel",
          { xPercent: 105, skewX: -4 },
          { xPercent: 0, skewX: 0, duration: 0.55, ease: "expo.out" },
          0,
        )
        .fromTo(
          ".drawer-stagger",
          { x: 40, opacity: 0 },
          { x: 0, opacity: 1, stagger: 0.04, duration: 0.4, ease: "power3.out" },
          0.12,
        );
    },
    { scope: root },
  );

  useEffect(() => {
    const tl = timeline.current;
    if (!tl) return;
    if (cartOpen) {
      tl.timeScale(1).play();
      lockScroll(true);
    } else if (tl.progress() > 0) {
      tl.timeScale(1.8).reverse();
      lockScroll(false);
    }
  }, [cartOpen]);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, setCartOpen]);

  useEffect(() => {
    if (!cartOpen || items.length === 0) return;
    const controller = new AbortController();
    fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        coupon: coupon || null,
      }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Quote | null) => data && setQuote(data))
      .catch(() => {});
    return () => controller.abort();
  }, [cartOpen, cartKey, coupon, items]);

  const lineTotals = new Map(quote?.lines.map((line) => [line.productId, line.total]) ?? []);
  const couponError = coupon && quote?.couponError ? errorText(dict, `coupon_${quote.couponError}`) : null;

  function submit() {
    setError(null);
    if (!player) {
      setUserOpen(true);
      return;
    }
    startTransition(async () => {
      const result = await checkout({
        player: player.name,
        email,
        coupon: coupon || null,
        lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      });
      if ("url" in result) {
        window.location.href = result.url;
      } else {
        setError(errorText(dict, result.error));
      }
    });
  }

  return (
    <div ref={root} className="invisible fixed inset-0 z-50" aria-hidden={!cartOpen}>
      <div className="drawer-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
      <aside
        role="dialog"
        aria-label={dict.cart.title}
        className="drawer-panel absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l-2 border-line bg-surface"
      >
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="drawer-stagger relative flex items-center justify-between border-b-2 border-line px-6 py-5">
          <h2 className="font-pixel text-2xl">{dict.cart.title}</h2>
          <button type="button" onClick={() => setCartOpen(false)} className="btn btn-ghost btn-sm !p-2" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="relative flex-1 space-y-3 overflow-y-auto px-6 py-5" data-lenis-prevent>
          {items.length === 0 ? (
            <div className="drawer-stagger flex h-full flex-col items-center justify-center gap-4 text-center">
              <PixelSprite seed="empty-cart" size={10} className="size-20 opacity-70" />
              <p className="font-pixel text-xl">{dict.cart.empty}</p>
              <p className="text-sm text-muted">{dict.cart.emptyHint}</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="drawer-stagger pixel-clip pixel-frame flex items-center gap-3 p-3 [--step:4px]">
                <div className="slot pixel-clip grid size-14 shrink-0 place-items-center [--step:3px]">
                  {item.image ? (
                    <img src={item.image} alt="" className="size-10 object-contain" />
                  ) : (
                    <PixelSprite seed={item.slug} className="size-10" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="font-mono text-sm text-accent">{money(lineTotals.get(item.productId) ?? item.price * item.quantity)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {item.maxQuantity > 1 && (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm !p-1.5"
                        onClick={() => cart.setQuantity(item.productId, item.quantity - 1)}
                        aria-label="-"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm !p-1.5"
                        disabled={item.quantity >= item.maxQuantity}
                        onClick={() => cart.setQuantity(item.productId, item.quantity + 1)}
                        aria-label="+"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm !p-1.5 hover:!bg-danger hover:text-black"
                    onClick={() => cart.remove(item.productId)}
                    aria-label={dict.cart.remove}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="relative space-y-4 border-t-2 border-line bg-bg-2/80 px-6 py-5">
            <form
              className="drawer-stagger flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                cart.setCoupon(couponInput.trim().toUpperCase());
              }}
            >
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-faint" />
                <input
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                  placeholder={dict.cart.coupon}
                  className="input !py-2.5 !pl-9 font-mono uppercase"
                />
              </div>
              <button type="submit" className="btn btn-ghost btn-sm">
                {dict.cart.apply}
              </button>
            </form>
            {couponError && <p className="-mt-2 text-sm text-danger">{couponError}</p>}

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={dict.cart.email}
              className="drawer-stagger input !py-2.5"
            />

            <dl className="drawer-stagger space-y-1.5 text-sm">
              <div className="flex justify-between text-muted">
                <dt>{dict.cart.subtotal}</dt>
                <dd className="font-mono">{money(quote?.subtotal ?? localSubtotal)}</dd>
              </div>
              {!!quote?.discount && (
                <div className="flex justify-between text-accent">
                  <dt>
                    {dict.cart.discount} <span className="font-mono">({quote.coupon})</span>
                  </dt>
                  <dd className="font-mono">-{money(quote.discount)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <dt className="font-pixel text-lg">{dict.cart.total}</dt>
                <dd className="font-pixel text-3xl text-accent">{money(quote?.total ?? localSubtotal)}</dd>
              </div>
            </dl>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="drawer-stagger flex items-center gap-3">
              {player && (
                <button
                  type="button"
                  onClick={() => setUserOpen(true)}
                  className="pixel-clip flex shrink-0 items-center gap-2 bg-surface-3 py-1.5 pr-3 pl-1.5 text-sm [--step:3px]"
                >
                  <PlayerAvatar name={player.name} size={32} className="size-8" />
                  <span className="max-w-24 truncate">{player.name}</span>
                </button>
              )}
              <button type="button" onClick={submit} disabled={pending} className="btn btn-primary flex-1 text-lg">
                {pending ? dict.cart.processing : player ? dict.cart.checkout : dict.cart.needUser}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
