"use client";

import Link from "next/link";
import { useRef } from "react";
import { ShoppingBag, UserRound } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { PlayerAvatar } from "./player-avatar";
import { useStore } from "./store-provider";
import { gsap, ScrollTrigger, useGSAP } from "./gsap";

type Props = { categories: { slug: string; name: string }[]; hue: number };

export function Header({ categories, hue }: Props) {
  const { dict, storeName, setCartOpen, setUserOpen, cartButtonRef } = useStore();
  const { items, player } = useCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const bar = useRef<HTMLElement>(null);
  const badge = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const show = gsap.quickTo(bar.current, "yPercent", { duration: 0.45, ease: "power3.out" });
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          const hidden = self.direction === 1 && self.scroll() > 240;
          show(hidden ? -120 : 0);
          bar.current?.toggleAttribute("data-scrolled", self.scroll() > 24);
        },
      });
      gsap.from(".nav-item", { y: -24, opacity: 0, stagger: 0.05, duration: 0.6, ease: "back.out(2)", delay: 0.35 });
    },
    { scope: bar },
  );

  useGSAP(() => {
    if (count > 0 && badge.current) {
      gsap.fromTo(badge.current, { scale: 0.2 }, { scale: 1, duration: 0.5, ease: "elastic.out(1.2, 0.4)" });
    }
  }, [count]);

  return (
    <header
      ref={bar}
      className="group fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4"
    >
      <div className="pixel-clip mx-auto flex h-16 max-w-7xl items-center gap-3 bg-bg-2/70 px-3 backdrop-blur-xl transition-colors duration-300 group-data-[scrolled]:bg-surface/85 sm:px-5 [--step:5px]">
        <Link href="/" className="nav-item flex items-center gap-2.5" aria-label={storeName}>
          <span className="pixel-clip grid size-10 place-items-center bg-surface-3 [--step:3px]">
            <PixelSprite seed={storeName} hue={hue} size={10} className="size-7" />
          </span>
          <span className="font-pixel text-lg leading-none font-semibold sm:text-xl">{storeName}</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {categories.slice(0, 5).map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="nav-item font-label px-3 py-2 text-[13px] text-muted uppercase transition-colors hover:text-accent"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="nav-item">
          <button
            type="button"
            onClick={() => setUserOpen(true)}
            className="btn btn-ghost btn-sm !py-1.5 !pl-1.5 normal-case"
          >
            {player ? (
              <>
                <PlayerAvatar name={player.name} size={32} className="size-7" />
                <span className="max-w-28 truncate font-sans text-[13px] font-semibold">{player.name}</span>
              </>
            ) : (
              <>
                <span className="grid size-7 place-items-center bg-bg-2">
                  <UserRound className="size-4" />
                </span>
                <span className="hidden sm:inline">{dict.user.set}</span>
              </>
            )}
          </button>
          </div>
          <div className="nav-item relative">
            <button
              ref={cartButtonRef}
              type="button"
              onClick={() => setCartOpen(true)}
              className="btn btn-primary btn-sm !px-3"
              aria-label={dict.nav.cart}
            >
              <ShoppingBag className="size-[18px]" />
              <span className="hidden sm:inline">{dict.nav.cart}</span>
            </button>
            {count > 0 && (
              <span
                ref={badge}
                className="badge pointer-events-none absolute -top-2 -right-2 bg-accent-2 text-white"
              >
                {count}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
