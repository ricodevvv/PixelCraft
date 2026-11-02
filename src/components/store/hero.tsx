"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check, Copy } from "lucide-react";
import { DiscordIcon } from "@/components/ui/discord-icon";
import { Starfield } from "./starfield";
import { Terrain } from "./terrain";
import { Voxel } from "./voxel";
import { useStore } from "./store-provider";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "./gsap";

type Status = { online: boolean; players: number; max: number };

type Props = { tagline: string; serverAddress: string; discordUrl: string; hue: number; announcement: string };

const cubes = [
  { seed: "a", size: 92, hueShift: 0, className: "left-[6%] top-[22%]", depth: 1.3, ore: false },
  { seed: "b", size: 64, hueShift: 150, className: "right-[9%] top-[18%]", depth: 0.9, ore: true },
  { seed: "c", size: 44, hueShift: -70, className: "left-[18%] bottom-[30%]", depth: 0.6, ore: true },
  { seed: "d", size: 120, hueShift: 30, className: "right-[14%] bottom-[24%] hidden md:block", depth: 1.6, ore: false },
  { seed: "e", size: 32, hueShift: 150, className: "left-[46%] top-[14%] hidden sm:block", depth: 0.4, ore: false },
];

function Magnetic({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  function move(event: React.PointerEvent) {
    if (event.pointerType !== "mouse" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    gsap.to(ref.current, {
      x: (event.clientX - rect.left - rect.width / 2) * 0.3,
      y: (event.clientY - rect.top - rect.height / 2) * 0.4,
      duration: 0.4,
      ease: "power3.out",
    });
  }
  function leave() {
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.4)" });
  }
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className="hero-cta inline-block">
      {children}
    </div>
  );
}

/**
 * The landing hero: split headline, scrambled tagline, floating voxels, live server status.
 */
export function Hero({ tagline, serverAddress, discordUrl, hue, announcement }: Props) {
  const { dict, storeName } = useStore();
  const root = useRef<HTMLElement>(null);
  const players = useRef<HTMLSpanElement>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus({ online: false, players: 0, max: 0 }));
  }, []);

  useGSAP(() => {
    if (!status?.online || !players.current) return;
    const counter = { value: 0 };
    gsap.to(counter, {
      value: status.players,
      duration: 1.6,
      ease: "power2.out",
      onUpdate: () => {
        if (players.current) players.current.textContent = Math.round(counter.value).toLocaleString();
      },
    });
  }, [status]);

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();
      const split = SplitText.create(".hero-title", { type: "chars,words", charsClass: "inline-block will-change-transform" });
      const intro = gsap.timeline({ delay: 0.45, defaults: { ease: "expo.out" } });

      intro
        .from(".hero-eyebrow", { opacity: 0, y: 16, duration: 0.6 })
        .from(
          split.chars,
          {
            yPercent: 130,
            rotationX: -100,
            scale: 0.4,
            opacity: 0,
            transformOrigin: "50% 100%",
            stagger: { each: 0.045, from: "start" },
            duration: 1.1,
          },
          "<0.1",
        )
        .to(".hero-tagline", { duration: 1.4, scrambleText: { text: tagline, chars: "▖▗▘▙▚▛▜▝▞▟█▓▒░", speed: 0.6, revealDelay: 0.2 } }, "-=0.6")
        .from(".hero-cta", { y: 30, opacity: 0, stagger: 0.08, duration: 0.8, ease: "back.out(1.8)" }, "-=1.1")
        .from(".hero-scroll", { opacity: 0, y: -10, duration: 0.6 }, "-=0.3");

      split.chars.forEach((char, index) => {
        const at = 0.75 + index * 0.045 + Math.random() * 0.35;
        const color = index % 3 === 0 ? "var(--accent-2)" : "var(--accent)";
        intro.set(char, { color }, at).set(char, { color: "" }, at + 0.14);
      });

      gsap.utils.toArray<HTMLElement>(".hero-cube").forEach((cube, index) => {
        const depth = Number(cube.dataset.depth ?? 1);
        gsap.from(cube, { scale: 0, opacity: 0, duration: 1.2, delay: 0.6 + index * 0.12, ease: "elastic.out(1, 0.5)" });
        if (reduced) return;
        const inner = cube.querySelector(".voxel");
        gsap.to(inner, {
          rotationY: index % 2 ? -360 : 360,
          rotationX: 360,
          duration: 18 + index * 4,
          ease: "none",
          repeat: -1,
        });
        gsap.to(cube, { y: "-=22", duration: 2.4 + index * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(cube, {
          yPercent: -120 * depth,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
      });

      if (!reduced) {
        gsap.utils.toArray<SVGElement>(".terrain-layer").forEach((layer) => {
          gsap.to(layer, {
            yPercent: Number(layer.dataset.speed) * 60,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
          });
        });
        gsap.to(".hero-content", {
          yPercent: 35,
          opacity: 0,
          filter: "blur(6px)",
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });

        const xTo = gsap.utils.toArray<HTMLElement>(".hero-cube").map((cube) => ({
          depth: Number(cube.dataset.depth ?? 1),
          x: gsap.quickTo(cube, "x", { duration: 1.2, ease: "power3.out" }),
        }));
        const onMove = (event: PointerEvent) => {
          const px = event.clientX / window.innerWidth - 0.5;
          xTo.forEach(({ x, depth }) => x(px * 60 * depth));
        };
        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
      }
    },
    { scope: root },
  );

  async function copyIp() {
    try {
      await navigator.clipboard.writeText(serverAddress);
    } catch {}
    setCopied(true);
    gsap.fromTo(".ip-button", { scale: 0.92 }, { scale: 1, duration: 0.6, ease: "elastic.out(1.2, 0.4)" });
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section ref={root} className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-28 pb-40">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,color-mix(in_oklch,var(--accent-2)_24%,transparent),transparent_70%),radial-gradient(ellipse_60%_50%_at_80%_80%,color-mix(in_oklch,var(--accent)_16%,transparent),transparent_70%)]" />
      <div className="absolute inset-0 -z-10">
        <Starfield hue={hue} />
      </div>
      <div className="grid-bg absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />

      {cubes.map((cube) => (
        <div
          key={cube.seed}
          data-depth={cube.depth}
          className={`hero-cube pointer-events-none absolute -z-10 [perspective:800px] ${cube.className}`}
        >
          <Voxel seed={cube.seed} hue={(hue + cube.hueShift + 360) % 360} size={cube.size} ore={cube.ore} />
        </div>
      ))}

      <div className="hero-content relative mx-auto w-full max-w-5xl px-5 text-center">
        {announcement && (
          <div className="hero-eyebrow mb-6 flex justify-center">
            <span className="pixel-clip bg-accent-2/15 px-4 py-1.5 text-sm text-accent-3 [--step:3px]">{announcement}</span>
          </div>
        )}
        <span className="hero-eyebrow eyebrow">{dict.hero.eyebrow}</span>
        <h1 className="hero-title font-pixel mt-5 text-[clamp(3.2rem,12vw,9.5rem)] leading-[0.9] font-bold tracking-tight [perspective:600px] [text-shadow:0_6px_0_rgb(0_0_0/0.35)]">
          {storeName}
        </h1>
        <p className="hero-tagline mx-auto mt-7 min-h-[3.5rem] max-w-2xl text-lg text-balance text-muted sm:text-xl">&nbsp;</p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Magnetic>
            <button type="button" onClick={copyIp} className="ip-button btn btn-primary group h-14 !pr-2 text-lg">
              <span className="font-mono text-base tracking-tight normal-case">{serverAddress}</span>
              <span className="pixel-clip ml-2 flex items-center gap-1.5 bg-accent-ink/90 px-3 py-1.5 text-sm text-accent [--step:3px]">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? dict.hero.copied : dict.hero.copyIp}
              </span>
            </button>
          </Magnetic>
          <Magnetic>
            <a href="#store" className="btn btn-ghost h-14 text-lg">
              {dict.hero.shopNow}
            </a>
          </Magnetic>
          {discordUrl && (
            <Magnetic>
              <a href={discordUrl} target="_blank" rel="noreferrer" className="btn h-14 bg-[#5865f2] text-lg text-white" aria-label={dict.hero.discord}>
                <DiscordIcon className="size-5" />
                <span className="hidden sm:inline">{dict.hero.discord}</span>
              </a>
            </Magnetic>
          )}
        </div>

        <div className="hero-cta mt-6 flex items-center justify-center gap-2 text-sm text-muted">
          {status === null ? (
            <span className="h-5" />
          ) : status.online ? (
            <>
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping bg-accent opacity-75" />
                <span className="relative inline-flex size-2.5 bg-accent" />
              </span>
              <span className="font-mono text-text" ref={players}>
                0
              </span>
              <span>{dict.hero.online}</span>
            </>
          ) : (
            <>
              <span className="size-2.5 bg-faint" />
              <span>{dict.hero.offline}</span>
            </>
          )}
        </div>
      </div>

      <Terrain />

      <a href="#store" className="hero-scroll absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-muted transition-colors hover:text-accent" aria-label={dict.hero.shopNow}>
        <ArrowDown className="size-6 animate-bounce" />
      </a>
    </section>
  );
}
