"use client";

import { useState } from "react";
import { Field } from "./field";

const presets = [145, 95, 45, 15, 330, 285, 250, 200];

/**
 * Accent color picker. Moves the --hue of the whole page so you see it live.
 */
export function HuePicker({ defaultValue }: { defaultValue: number }) {
  const [hue, setHue] = useState(defaultValue);

  function apply(value: number) {
    setHue(value);
    document.documentElement.style.setProperty("--hue", String(value));
  }

  return (
    <Field label="Accent color" hint="Everything in the store follows this hue.">
      <input type="hidden" name="accentHue" value={hue} />
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => apply(preset)}
            aria-label={`Hue ${preset}`}
            className={`pixel-clip size-9 [--step:3px] ${hue === preset ? "ring-2 ring-text" : ""}`}
            style={{ background: `oklch(0.87 0.2 ${preset})`, outline: hue === preset ? "2px solid var(--text)" : undefined, outlineOffset: 2 }}
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(event) => apply(Number(event.target.value))}
        className="mt-4 h-3 w-full cursor-pointer appearance-none [background:linear-gradient(90deg,oklch(0.87_0.2_0),oklch(0.87_0.2_60),oklch(0.87_0.2_120),oklch(0.87_0.2_180),oklch(0.87_0.2_240),oklch(0.87_0.2_300),oklch(0.87_0.2_360))] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-text [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_var(--bg)]"
      />
    </Field>
  );
}
