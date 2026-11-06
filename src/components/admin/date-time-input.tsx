"use client";

import { useState } from "react";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * datetime-local picker that submits a real ISO timestamp, so the server never guesses the timezone.
 */
export function DateTimeInput({ name, defaultValue = null, required = false }: { name: string; defaultValue?: string | null; required?: boolean }) {
  const [local, setLocal] = useState(() => toLocalInput(defaultValue));
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <>
      <input type="datetime-local" value={local} required={required} onChange={(event) => setLocal(event.target.value)} className="input font-mono" />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}

/**
 * Shows a timestamp in the viewer's own timezone.
 */
export function LocalTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
    </time>
  );
}
