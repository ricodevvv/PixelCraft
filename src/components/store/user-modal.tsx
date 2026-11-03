"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { cart, useCart } from "@/lib/cart-store";
import { PlayerAvatar } from "./player-avatar";
import { lockScroll } from "./smooth-scroll";
import { useStore } from "./store-provider";
import { gsap, useGSAP } from "./gsap";

const NAME = /^\.?[A-Za-z0-9_]{2,16}$/;

export function UserModal() {
  const { dict, userOpen, setUserOpen, cartOpen } = useStore();
  const { player } = useCart();
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const timeline = useRef<gsap.core.Timeline>(null);
  const [wasOpen, setWasOpen] = useState(userOpen);

  if (userOpen !== wasOpen) {
    setWasOpen(userOpen);
    if (userOpen) {
      setName(player?.name ?? "");
      setPreview(player?.name ?? null);
      setError(null);
    }
  }

  useGSAP(
    () => {
      timeline.current = gsap
        .timeline({ paused: true })
        .set(root.current, { visibility: "visible" })
        .fromTo(".modal-backdrop", { opacity: 0 }, { opacity: 1, duration: 0.25 })
        .fromTo(
          ".modal-card",
          { y: 60, scale: 0.85, rotationX: 35, opacity: 0, transformPerspective: 900 },
          { y: 0, scale: 1, rotationX: 0, opacity: 1, duration: 0.6, ease: "back.out(1.6)" },
          0,
        )
        .fromTo(".modal-avatar", { y: -40, scale: 0 }, { y: 0, scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" }, 0.2);
    },
    { scope: root },
  );

  useEffect(() => {
    const tl = timeline.current;
    if (!tl) return;
    if (userOpen) {
      tl.timeScale(1).play();
      lockScroll(true);
      setTimeout(() => input.current?.focus(), 250);
    } else if (tl.progress() > 0) {
      tl.timeScale(2).reverse();
      if (!cartOpen) lockScroll(false);
    }
  }, [userOpen, cartOpen]);

  useEffect(() => {
    const trimmed = name.trim();
    if (!NAME.test(trimmed)) return;
    const timer = setTimeout(() => setPreview(trimmed), 450);
    return () => clearTimeout(timer);
  }, [name]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!NAME.test(trimmed)) {
      setError(dict.user.invalid);
      gsap.fromTo(".modal-card", { x: -10 }, { x: 0, duration: 0.5, ease: "elastic.out(2, 0.2)" });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/player/${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setError(res.status === 404 ? dict.user.notFound : dict.user.invalid);
        gsap.fromTo(".modal-card", { x: -10 }, { x: 0, duration: 0.5, ease: "elastic.out(2, 0.2)" });
        return;
      }
      const data = (await res.json()) as { name: string; uuid: string | null };
      cart.setPlayer({ name: data.name, uuid: data.uuid });
      setUserOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={root} className="invisible fixed inset-0 z-[60] grid place-items-center p-4" aria-hidden={!userOpen}>
      <div className="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setUserOpen(false)} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-label={dict.user.title}
        className="modal-card pixel-clip pixel-frame relative w-full max-w-sm p-7 pt-16 text-center [--fill:var(--surface)] [--frame:var(--line-strong)] [--step:6px]"
      >
        <button
          type="button"
          onClick={() => setUserOpen(false)}
          className="absolute top-4 right-4 text-muted transition-colors hover:text-text"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
        <div className="modal-avatar absolute -top-0 left-1/2 -translate-x-1/2 translate-y-4">
          <div className="slot pixel-clip grid size-24 place-items-center [--step:4px]">
            {preview ? (
              <PlayerAvatar key={preview} name={preview} size={128} body className="h-20 w-auto" />
            ) : (
              <span className="font-pixel text-4xl text-faint">?</span>
            )}
          </div>
        </div>
        <h2 className="font-pixel mt-14 text-3xl">{dict.user.title}</h2>
        <p className="mt-2 text-sm text-muted">{dict.user.hint}</p>
        <input
          ref={input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={dict.user.placeholder}
          maxLength={17}
          autoComplete="off"
          spellCheck={false}
          className="input mt-6 text-center font-mono text-lg"
        />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary mt-5 w-full text-lg">
          {loading ? <LoaderCircle className="size-5 animate-spin" /> : dict.user.confirm}
          {!loading && <ArrowRight className="size-5" />}
        </button>
      </form>
    </div>
  );
}
