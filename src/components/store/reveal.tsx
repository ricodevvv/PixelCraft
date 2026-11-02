"use client";

import { usePathname } from "next/navigation";
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from "./gsap";

/**
 * Fades and lifts every [data-reveal] element in batches as it scrolls into view.
 */
export function Reveal() {
  const pathname = usePathname();

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      gsap.set(targets, { opacity: 0, y: 60, rotationX: 12, transformPerspective: 900 });
      ScrollTrigger.batch(targets, {
        start: "top 92%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            rotationX: 0,
            stagger: 0.08,
            duration: 0.9,
            ease: "expo.out",
            clearProps: "transform,opacity",
          }),
      });
      requestAnimationFrame(() => ScrollTrigger.refresh());
    },
    { dependencies: [pathname], revertOnUpdate: true },
  );

  return null;
}
