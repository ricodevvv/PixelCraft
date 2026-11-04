"use client";

import { useState } from "react";

type Point = { date: string; total: number; orders: number };

/**
 * Daily revenue bars with a hover tooltip. One series, so the title names it and there's no legend.
 */
export function RevenueChart({ data, format }: { data: Point[]; format: { currency: string; locale: string; digits: number } }) {
  const [hover, setHover] = useState<number | null>(null);
  const money = (value: number) =>
    new Intl.NumberFormat(format.locale, { style: "currency", currency: format.currency }).format(value / 10 ** format.digits);
  const max = Math.max(1, ...data.map((point) => point.total));
  const width = 720;
  const height = 220;
  const padBottom = 24;
  const padTop = 12;
  const slot = width / data.length;
  const bar = Math.max(4, slot - 6);
  const ticks = [0, 0.5, 1].map((ratio) => ({ ratio, value: max * ratio }));
  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full overflow-visible" role="img" aria-label="Daily revenue, last 30 days">
        {ticks.map(({ ratio, value }) => {
          const y = padTop + (height - padTop - padBottom) * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={0} x2={width} y1={y} y2={y} stroke="var(--line)" strokeDasharray={ratio === 0 ? undefined : "2 4"} />
              {ratio > 0 && (
                <text x={0} y={y - 4} fill="var(--faint)" fontSize={10} fontFamily="var(--font-geist-mono)">
                  {money(value)}
                </text>
              )}
            </g>
          );
        })}
        {data.map((point, index) => {
          const h = ((height - padTop - padBottom) * point.total) / max;
          const x = index * slot + (slot - bar) / 2;
          const y = height - padBottom - h;
          return (
            <g key={point.date} onPointerEnter={() => setHover(index)} onPointerLeave={() => setHover(null)}>
              <rect x={index * slot} y={padTop} width={slot} height={height - padTop - padBottom} fill="transparent" />
              {point.total > 0 && (
                <path
                  d={`M${x},${height - padBottom} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + bar - 4} Q${x + bar},${y} ${x + bar},${y + 4} V${height - padBottom} Z`}
                  fill={hover === null || hover === index ? "var(--accent)" : "color-mix(in oklch, var(--accent) 45%, var(--surface))"}
                />
              )}
              {(index === data.length - 1 || (index % 7 === 0 && index < data.length - 4)) && (
                <text x={index * slot + slot / 2} y={height - 6} textAnchor="middle" fill="var(--faint)" fontSize={10} fontFamily="var(--font-geist-mono)">
                  {point.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {active && hover !== null && (
        <div
          className="pixel-clip pointer-events-none absolute top-0 z-10 -translate-x-1/2 bg-surface-3 px-3 py-2 text-xs shadow-lg [--step:3px]"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
        >
          <p className="font-mono text-faint">{active.date}</p>
          <p className="font-semibold text-text">{money(active.total)}</p>
          <p className="text-muted">
            {active.orders} order{active.orders === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}
