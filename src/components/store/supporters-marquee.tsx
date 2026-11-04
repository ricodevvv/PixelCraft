"use client";

import { useRef } from "react";
import { PlayerAvatar } from "./player-avatar";
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from "./gsap";

type Supporter = { id: number; playerName: string; itemName: string | null };

/**
 * Endless strip of recent buyers. Scrolling faster makes it run faster.
 */
export function SupportersMarquee({ supporters }: { supporters: Supporter[] }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const loop = gsap.to(".marquee-track", { xPercent: -50, duration: 40, ease: "none", repeat: -1 });
      ScrollTrigger.create({
        trigger: root.current,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 400, 6);
          gsap.to(loop, { timeScale: boost * (self.direction || 1), duration: 0.2, overwrite: true });
          gsap.to(loop, { timeScale: self.direction || 1, duration: 1.2, delay: 0.2, overwrite: false });
        },
      });
    },
    { scope: root },
  );

  if (supporters.length === 0) return null;
  const list = supporters.length < 6 ? [...supporters, ...supporters, ...supporters] : supporters;

  return (
    <div ref={root} className="relative overflow-hidden border-y-2 border-line bg-bg-2 py-4 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <div className="marquee-track flex w-max gap-3">
        {[...list, ...list].map((supporter, index) => (
          <div key={`${supporter.id}-${index}`} className="pixel-clip flex items-center gap-3 bg-surface-2 py-2 pr-5 pl-2 [--step:3px]">
            <PlayerAvatar name={supporter.playerName} size={32} className="size-8" />
            <span className="font-pixel text-[15px]">{supporter.playerName}</span>
            {supporter.itemName && <span className="text-sm text-muted">· {supporter.itemName}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
