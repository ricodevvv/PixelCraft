"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

const COLS = 14;
const ROWS = 8;

/**
 * A curtain of pixel blocks that breaks apart on every navigation.
 */
export function PixelTransition() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        gsap.set(root.current, { display: "none" });
        return;
      }
      gsap
        .timeline()
        .to(".pixel-block", {
          scale: 0,
          rotation: () => gsap.utils.random(-90, 90),
          duration: 0.42,
          ease: "power2.in",
          stagger: { amount: 0.5, from: "random", grid: [ROWS, COLS] },
        })
        .set(root.current, { display: "none" });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className="pointer-events-none fixed inset-0 z-[70] grid"
      style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
      aria-hidden="true"
    >
      {Array.from({ length: COLS * ROWS }, (_, index) => (
        <span
          key={index}
          className="pixel-block -m-px block"
          style={{
            background: index % 7 === 0 ? "var(--accent-deep)" : index % 5 === 0 ? "var(--surface-2)" : "var(--bg)",
          }}
        />
      ))}
    </div>
  );
}
