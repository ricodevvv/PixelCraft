"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cart } from "@/lib/cart-store";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

/**
 * Pixel confetti burst for a paid order. Also empties the cart.
 */
export function Celebration() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => cart.clear(), []);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.utils.toArray<HTMLElement>(".confetti").forEach((piece) => {
        gsap.fromTo(
          piece,
          { x: 0, y: 0, rotation: 0, opacity: 1, scale: gsap.utils.random(0.6, 1.5) },
          {
            x: gsap.utils.random(-480, 480),
            y: gsap.utils.random(-420, -120),
            rotation: gsap.utils.random(-720, 720),
            duration: gsap.utils.random(0.7, 1.1),
            ease: "power3.out",
            delay: 0.5,
            onComplete: () => {
              gsap.to(piece, { y: "+=700", opacity: 0, rotation: "+=180", duration: gsap.utils.random(1.4, 2.4), ease: "power1.in" });
            },
          },
        );
      });
    },
    { scope: root },
  );

  const colors = ["var(--accent)", "var(--accent-2)", "var(--accent-3)", "#fff"];
  return (
    <div ref={root} className="pointer-events-none fixed top-1/2 left-1/2 z-[65]" aria-hidden="true">
      {Array.from({ length: 70 }, (_, index) => (
        <span key={index} className="confetti absolute size-2.5" style={{ background: colors[index % colors.length], opacity: 0 }} />
      ))}
    </div>
  );
}

/**
 * Refreshes the page every few seconds while an order is still waiting for payment.
 */
export function AutoRefresh({ every = 3000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), every);
    return () => clearInterval(timer);
  }, [router, every]);
  return null;
}
