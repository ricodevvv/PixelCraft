"use client";

import { useEffect, useRef, useState } from "react";
import { PixelSprite } from "@/components/ui/pixel-sprite";

type Props = { name: string; size?: number; className?: string; body?: boolean };

/**
 * Player head from mc-heads.net, with a generated sprite when the skin can't load.
 */
export function PlayerAvatar({ name, size = 64, className = "", body = false }: Props) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, [name]);

  if (failed || name.startsWith(".")) {
    return <PixelSprite seed={name} size={8} className={`pixelated ${className}`} />;
  }
  return (
    <img
      ref={img}
      src={`https://mc-heads.net/${body ? "body" : "avatar"}/${encodeURIComponent(name)}/${size}`}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`pixelated ${className}`}
    />
  );
}
