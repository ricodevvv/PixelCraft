"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./gsap";

type Star = { x: number; y: number; size: number; speed: number; phase: number; depth: number; tint: number };

/**
 * Canvas of square pixel stars that twinkle, drift and lean towards the cursor.
 */
export function Starfield({ hue, className = "" }: { hue: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;

    const reduced = prefersReducedMotion();
    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let mouseX = 0;
    let mouseY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = el.clientWidth;
      height = el.clientHeight;
      el.width = width * dpr;
      el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((width * height) / 5200);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() < 0.12 ? 3 : Math.random() < 0.5 ? 2 : 1,
        speed: 0.6 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
        depth: 0.2 + Math.random() * 0.8,
        tint: Math.random(),
      }));
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      offsetX += (mouseX - offsetX) * 0.04;
      offsetY += (mouseY - offsetY) * 0.04;
      for (const star of stars) {
        const twinkle = reduced ? 0.8 : 0.35 + 0.65 * Math.abs(Math.sin(time / 1000 * star.speed + star.phase));
        const drift = reduced ? 0 : (time / 1000) * 4 * star.depth;
        const x = (((star.x + drift + offsetX * 30 * star.depth) % width) + width) % width;
        const y = star.y + offsetY * 20 * star.depth;
        const color =
          star.tint > 0.86 ? `oklch(0.85 0.17 ${hue} / ${twinkle})` : star.tint > 0.78 ? `oklch(0.8 0.15 ${hue + 150} / ${twinkle})` : `rgb(255 255 255 / ${twinkle * 0.85})`;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), star.size, star.size);
        if (star.size === 3 && twinkle > 0.85) {
          ctx.fillRect(Math.round(x) - 2, Math.round(y) + 1, 7, 1);
          ctx.fillRect(Math.round(x) + 1, Math.round(y) - 2, 1, 7);
        }
      }
      if (!reduced && visible) frame = requestAnimationFrame(draw);
    };

    const onMove = (event: PointerEvent) => {
      mouseX = event.clientX / window.innerWidth - 0.5;
      mouseY = event.clientY / window.innerHeight - 0.5;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) frame = requestAnimationFrame(draw);
    });

    resize();
    observer.observe(el);
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [hue]);

  return <canvas ref={canvas} className={`pointer-events-none size-full ${className}`} aria-hidden="true" />;
}
