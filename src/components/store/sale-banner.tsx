"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, Zap } from "lucide-react";
import { Countdown } from "./countdown";
import { useStore } from "./store-provider";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

type Props = { name: string; percent: number; endsAt: string; categoryName: string | null; href: string };

/**
 * Big animated strip for the best running sale, with a live countdown.
 */
export function SaleBanner({ name, percent, endsAt, categoryName, href }: Props) {
  const { dict } = useStore();
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap
        .timeline({ scrollTrigger: { trigger: root.current, start: "top 90%", once: true } })
        .from(root.current, { clipPath: "inset(0 50% 0 50%)", duration: 0.9, ease: "expo.out" })
        .from(".sale-percent", { scale: 0.2, rotation: -20, opacity: 0, duration: 0.9, ease: "elastic.out(1, 0.45)" }, "-=0.5")
        .from(".sale-copy > *", { y: 20, opacity: 0, stagger: 0.08, duration: 0.5, ease: "power3.out" }, "-=0.6");
      gsap.to(".sale-percent", { textShadow: "0 0 28px var(--accent-2)", scale: 1.04, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(".sale-zap", { rotation: 12, duration: 0.12, ease: "steps(2)", yoyo: true, repeat: -1, repeatDelay: 1.6 });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="pixel-clip relative mx-auto mt-10 max-w-7xl overflow-hidden [--step:8px]" aria-label={name}>
      <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,color-mix(in_oklch,var(--accent-2)_22%,var(--surface))_0_18px,color-mix(in_oklch,var(--accent-2)_12%,var(--surface))_18px_36px)] [animation:sale-stripes_1.2s_linear_infinite] [background-size:51px_51px]" />
      <div className="relative flex flex-col items-start gap-6 p-6 sm:p-8 md:flex-row md:items-center">
        <div className="sale-percent font-pixel text-7xl leading-none font-bold text-white sm:text-8xl">-{percent}%</div>
        <div className="sale-copy flex-1">
          <p className="eyebrow !text-accent-3">
            <Zap className="sale-zap size-4" /> {name}
          </p>
          <p className="font-pixel mt-2 text-2xl leading-tight sm:text-3xl">
            {dict.sale.off.replace("{n}", String(percent))} {dict.sale.on} {categoryName ?? dict.sale.everything}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="font-label text-[11px] text-muted uppercase">{dict.sale.endsIn}</span>
            <Countdown endsAt={endsAt} units={dict.sale.units} />
          </div>
        </div>
        <Link href={href} className="btn btn-primary h-14 shrink-0 text-lg">
          {dict.sale.shop} <ArrowRight className="size-5" />
        </Link>
      </div>
    </section>
  );
}
