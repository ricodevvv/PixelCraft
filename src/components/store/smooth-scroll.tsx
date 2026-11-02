"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, prefersReducedMotion, ScrollTrigger } from "./gsap";

/**
 * Lenis smooth scrolling driven by the GSAP ticker so ScrollTrigger stays in sync.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95, anchors: { offset: -90 } });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    (window as unknown as { lenis?: Lenis }).lenis = lenis;
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      delete (window as unknown as { lenis?: Lenis }).lenis;
    };
  }, []);
  return null;
}

export function lockScroll(locked: boolean) {
  const lenis = (window as unknown as { lenis?: Lenis }).lenis;
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.documentElement.style.overflow = locked ? "hidden" : "";
}
