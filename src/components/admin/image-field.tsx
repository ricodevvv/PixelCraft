"use client";

import { useRef, useState, useTransition } from "react";
import { ImageUp, LoaderCircle, X } from "lucide-react";
import { uploadImage } from "@/app/admin/actions";
import { PixelSprite } from "@/components/ui/pixel-sprite";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 4 * 1024 * 1024;

type Props = {
  name: string;
  label: string;
  hint: string;
  defaultValue: string;
  folder: "products" | "categories";
  uploadEnabled: boolean;
  spriteSeed: string;
};

/**
 * Image picker for the admin: upload to Vercel Blob when it's set up, or paste a URL either way.
 */
export function ImageField({ name, label, hint, defaultValue, folder, uploadEnabled, spriteSeed }: Props) {
  const [url, setUrl] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Use a PNG, JPG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Images can be up to 4 MB.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("folder", folder);
    startTransition(async () => {
      try {
        const result = await uploadImage(form);
        if ("url" in result) setUrl(result.url);
        else setError(result.error);
      } catch {
        setError("Upload failed. Try again or paste a URL.");
      }
    });
  }

  return (
    <div>
      <span className="font-label text-[11px] text-muted uppercase">{label}</span>
      <div className="mt-2 flex gap-4">
        <div className="slot pixel-clip relative grid size-24 shrink-0 place-items-center [--step:4px]">
          {pending ? (
            <LoaderCircle className="size-6 animate-spin text-accent" />
          ) : url ? (
            <img src={url} alt="" className="size-16 object-contain" />
          ) : (
            <PixelSprite seed={spriteSeed || "new"} className="size-14 opacity-60" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            name={name}
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://..."
            className="input"
          />
          <div className="flex flex-wrap gap-2">
            {uploadEnabled && (
              <>
                <input
                  ref={input}
                  type="file"
                  accept={ACCEPTED.join(",")}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) upload(file);
                    event.target.value = "";
                  }}
                />
                <button type="button" disabled={pending} onClick={() => input.current?.click()} className="btn btn-ghost btn-sm">
                  <ImageUp className="size-3.5" /> Upload image
                </button>
              </>
            )}
            {url && (
              <button type="button" onClick={() => setUrl("")} className="btn btn-ghost btn-sm">
                <X className="size-3.5" /> Remove
              </button>
            )}
          </div>
        </div>
      </div>
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </div>
  );
}
