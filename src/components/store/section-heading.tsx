"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "./gsap";

type Props = { eyebrow: string; title: string; children?: React.ReactNode; align?: "left" | "center" };

/**
 * Section title whose words rise out of a mask when scrolled into view.
 */
export function SectionHeading({ eyebrow, title, children, align = "left" }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const split = SplitText.create(".section-title", { type: "words", mask: "words" });
      gsap
        .timeline({ scrollTrigger: { trigger: root.current, start: "top 85%", once: true } })
        .from(".section-eyebrow", { opacity: 0, x: -20, duration: 0.5, ease: "power3.out" })
        .to(".section-eyebrow", { duration: 0.8, scrambleText: { text: eyebrow, chars: "01#$%&@", speed: 0.8 } }, "<")
        .from(split.words, { yPercent: 110, stagger: 0.06, duration: 0.9, ease: "expo.out" }, "<0.1")
        .from(".section-extra", { opacity: 0, y: 12, duration: 0.6 }, "-=0.5");
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className={`flex flex-col gap-4 sm:flex-row sm:items-end ${align === "center" ? "items-center text-center sm:justify-center" : "sm:justify-between"}`}
    >
      <div>
        <span className="section-eyebrow eyebrow">{eyebrow}</span>
        <h2 className="section-title font-pixel mt-3 text-4xl leading-none font-bold text-balance sm:text-5xl">{title}</h2>
      </div>
      {children && <div className="section-extra">{children}</div>}
    </div>
  );
}
