"use client";

import { useRef } from "react";
import { useStore } from "./store-provider";
import { gsap, useGSAP } from "./gsap";

const SEGMENTS = 40;

/**
 * Monthly community goal as a segmented pixel bar that fills block by block.
 */
export function GoalBar({ current, goal }: { current: number; goal: number }) {
  const { dict, money } = useStore();
  const root = useRef<HTMLDivElement>(null);
  const amount = useRef<HTMLSpanElement>(null);
  const percent = Math.min(100, Math.round((current / goal) * 100));
  const filled = Math.round((percent / 100) * SEGMENTS);

  useGSAP(
    () => {
      const counter = { value: 0 };
      const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 85%", once: true } });
      tl.from(".goal-segment", { scaleY: 0, transformOrigin: "50% 100%", stagger: 0.012, duration: 0.3, ease: "back.out(3)" })
        .from(
          ".goal-fill",
          { scaleX: 0, transformOrigin: "0% 50%", stagger: 0.03, duration: 0.12, ease: "steps(3)" },
          0.2,
        )
        .to(
          counter,
          {
            value: current,
            duration: Math.max(0.6, filled * 0.03),
            ease: "none",
            onUpdate: () => {
              if (amount.current) amount.current.textContent = money(Math.round(counter.value));
            },
          },
          0.2,
        );
    },
    { scope: root },
  );

  return (
    <div ref={root} className="pixel-clip pixel-frame p-6 [--step:6px] sm:p-8" data-reveal>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">{dict.home.goal}</span>
          <p className="mt-2 text-muted">{dict.home.goalText}</p>
        </div>
        <p className="font-pixel text-3xl">
          <span ref={amount} className="text-accent">
            {money(current)}
          </span>
          <span className="text-faint"> / {money(goal)}</span>
        </p>
      </div>
      <div className="mt-6 flex h-8 gap-[3px]">
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span key={index} className="goal-segment flex-1 bg-surface-3">
            {index < filled && (
              <i className="goal-fill block size-full bg-accent shadow-[0_0_14px_color-mix(in_oklch,var(--accent)_60%,transparent)]" />
            )}
          </span>
        ))}
      </div>
      <p className="font-label mt-3 text-right text-xs text-muted">{percent}%</p>
    </div>
  );
}
