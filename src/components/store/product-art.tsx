"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";
import { ItemImage } from "@/components/ui/item-image";

/**
 * Big floating product art with orbiting pixel sparkles.
 */
export function ProductArt({ id, slug, image, name }: { id: string; slug: string; image: string | null; name: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".art-item", { scale: 0.3, rotation: -25, opacity: 0, duration: 1.2, ease: "elastic.out(1, 0.45)", delay: 0.4 });
      if (prefersReducedMotion()) return;
      gsap.to(".art-item", { y: -18, rotation: 3, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(".art-shadow", { scaleX: 0.75, opacity: 0.35, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.utils.toArray<HTMLElement>(".sparkle").forEach((sparkle) => {
        const loop = () =>
          gsap.fromTo(
            sparkle,
            { left: `${gsap.utils.random(10, 90)}%`, top: `${gsap.utils.random(10, 85)}%`, scale: 0, opacity: 1 },
            {
              scale: gsap.utils.random(0.6, 1.4),
              y: gsap.utils.random(-50, -20),
              opacity: 0,
              duration: gsap.utils.random(1.2, 2.4),
              ease: "power1.out",
              delay: gsap.utils.random(0, 1.5),
              onComplete: loop,
            },
          );
        loop();
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="slot pixel-clip relative grid aspect-square place-items-center overflow-hidden [--step:8px]">
      <div className="grid-bg absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklch,var(--accent)_22%,transparent),transparent_60%)]" />
      {Array.from({ length: 10 }, (_, index) => (
        <span key={index} className={`sparkle absolute size-2 ${index % 3 ? "bg-accent" : "bg-accent-2"}`} />
      ))}
      <div className="relative flex flex-col items-center">
        <div id={id} className="art-item size-[min(60vw,22rem)]">
          <ItemImage src={image} seed={slug} alt={name} className="size-full object-contain drop-shadow-[0_24px_30px_rgb(0_0_0/0.55)]" spriteClassName="size-full drop-shadow-[0_24px_30px_rgb(0_0_0/0.55)]" />
        </div>
        <div className="art-shadow mt-4 h-4 w-1/2 bg-black/60 blur-md" />
      </div>
    </div>
  );
}
