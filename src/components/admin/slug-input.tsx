"use client";

import { useState } from "react";
import { Field } from "./field";

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Name and slug inputs. The slug follows the name until you edit it by hand.
 */
export function SlugInput({ defaultName, defaultSlug }: { defaultName: string; defaultSlug: string }) {
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(defaultSlug);
  const [touched, setTouched] = useState(Boolean(defaultSlug));

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Name">
        <input
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!touched) setSlug(slugify(event.target.value));
          }}
          className="input"
        />
      </Field>
      <Field label="Slug" hint="Used in the URL.">
        <input
          name="slug"
          required
          value={slug}
          onChange={(event) => {
            setTouched(true);
            setSlug(event.target.value);
          }}
          className="input font-mono"
        />
      </Field>
    </div>
  );
}
