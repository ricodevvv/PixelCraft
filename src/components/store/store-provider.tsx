"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { gsap, prefersReducedMotion } from "./gsap";

type StoreConfig = {
  dict: Dictionary;
  locale: Locale;
  currency: string;
  storeName: string;
  requirePremium: boolean;
};

type StoreContextValue = StoreConfig & {
  money: (amount: number) => string;
  cartOpen: boolean;
  userOpen: boolean;
  setCartOpen: (open: boolean) => void;
  setUserOpen: (open: boolean) => void;
  cartButtonRef: RefObject<HTMLButtonElement | null>;
  flyToCart: (source: HTMLElement) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <StoreProvider>");
  return value;
}

/**
 * Shared store UI state: dictionary, money formatting, drawers and the fly-to-cart effect.
 */
export function StoreProvider({
  children,
  dict,
  locale,
  currency,
  storeName,
  requirePremium,
}: StoreConfig & { children: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const cartButtonRef = useRef<HTMLButtonElement | null>(null);

  const money = useCallback(
    (amount: number) => formatMoney(amount, currency, locale),
    [currency, locale],
  );

  const flyToCart = useCallback((source: HTMLElement) => {
    const target = cartButtonRef.current;
    if (!target) return;
    if (prefersReducedMotion()) {
      gsap.fromTo(target, { scale: 1.2 }, { scale: 1, duration: 0.3 });
      return;
    }
    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const ghost = source.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      margin: "0",
      zIndex: "100",
      pointerEvents: "none",
      filter: "drop-shadow(0 0 18px var(--accent))",
    });
    document.body.appendChild(ghost);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const lift = Math.min(-120, dy - 160);

    gsap
      .timeline({ onComplete: () => ghost.remove() })
      .to(ghost, {
        duration: 0.85,
        ease: "power2.in",
        motionPath: { path: [{ x: dx * 0.35, y: lift }, { x: dx, y: dy }], curviness: 1.4 },
        scale: 0.18,
        rotation: 200,
      })
      .to(ghost, { opacity: 0, duration: 0.12 }, "-=0.1")
      .fromTo(
        target,
        { scale: 1.35, rotation: -8 },
        { scale: 1, rotation: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" },
        "-=0.12",
      );
  }, []);

  const value = useMemo(
    () => ({
      dict,
      locale,
      currency,
      storeName,
      requirePremium,
      money,
      cartOpen,
      userOpen,
      setCartOpen,
      setUserOpen,
      cartButtonRef,
      flyToCart,
    }),
    [dict, locale, currency, storeName, requirePremium, money, cartOpen, userOpen, flyToCart],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
