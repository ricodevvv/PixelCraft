"use client";

import { useEffect, useRef, useState } from "react";
import { PixelSprite } from "./pixel-sprite";

type Props = { src: string | null | undefined; seed: string; alt?: string; className?: string; spriteClassName?: string };

/**
 * Product or category image that falls back to its pixel sprite when there's no URL or the image fails to load.
 */
export function ItemImage({ src, seed, alt = "", className = "", spriteClassName }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = img.current;
    if (src && el?.complete && el.naturalWidth === 0) setFailedSrc(src);
  }, [src]);

  if (!src || failedSrc === src) {
    return <PixelSprite seed={seed} className={spriteClassName ?? className} />;
  }
  return <img ref={img} src={src} alt={alt} onError={() => setFailedSrc(src)} className={className} />;
}
