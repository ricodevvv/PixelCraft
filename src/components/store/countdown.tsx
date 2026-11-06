"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap, prefersReducedMotion } from "./gsap";

type Units = { d: string; h: string; m: string; s: string };

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

/**
 * Live countdown in pixel blocks. Digits hop when they change, and the page refreshes when it hits zero.
 */
export function Countdown({ endsAt, units, size = "md" }: { endsAt: string; units: Units; size?: "sm" | "md" }) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef<Record<string, number>>({});

  useEffect(() => {
    const end = new Date(endsAt).getTime();
    let refreshed = false;
    const tick = () => {
      const ms = end - Date.now();
      setLeft(ms);
      if (ms <= 0 && !refreshed) {
        refreshed = true;
        router.refresh();
      }
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [endsAt, router]);

  const parts = left === null ? null : split(left);

  useEffect(() => {
    if (!parts || !root.current || prefersReducedMotion()) return;
    for (const key of ["d", "h", "m", "s"] as const) {
      if (previous.current[key] !== undefined && previous.current[key] !== parts[key]) {
        gsap.fromTo(root.current.querySelector(`[data-unit="${key}"]`), { y: -6, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.35, ease: "back.out(3)" });
      }
      previous.current[key] = parts[key];
    }
  });

  const cells: { key: keyof Units; value: number | null }[] = [
    { key: "d", value: parts?.d ?? null },
    { key: "h", value: parts?.h ?? null },
    { key: "m", value: parts?.m ?? null },
    { key: "s", value: parts?.s ?? null },
  ];
  const visible = parts && parts.d === 0 ? cells.slice(1) : cells;
  const box = size === "sm" ? "min-w-9 px-1.5 py-1 text-base" : "min-w-12 px-2 py-1.5 text-2xl";

  return (
    <div ref={root} className="flex items-center gap-1.5" aria-live="off">
      {visible.map(({ key, value }) => (
        <span key={key} className={`pixel-clip flex items-baseline justify-center gap-0.5 bg-bg-2/80 [--step:3px] ${box}`}>
          <span data-unit={key} className="font-pixel inline-block tabular-nums">
            {value === null ? "--" : String(value).padStart(2, "0")}
          </span>
          <span className="font-label text-[9px] text-muted uppercase">{units[key]}</span>
        </span>
      ))}
    </div>
  );
}
