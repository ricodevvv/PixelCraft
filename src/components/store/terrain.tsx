function steppedPath(seed: number, columns: number, rows: number, base: number, rough: number): string {
  let state = seed;
  const rand = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  let height = base;
  let d = `M0 ${rows}`;
  for (let x = 0; x < columns; x++) {
    if (rand() < 0.55) height += Math.round((rand() - 0.5) * rough);
    height = Math.max(2, Math.min(rows - 1, height));
    d += ` L${x} ${rows - height} L${x + 1} ${rows - height}`;
  }
  return `${d} L${columns} ${rows} Z`;
}

const layers = [
  { seed: 7, base: 22, rough: 5, fill: "color-mix(in oklch, var(--accent-2) 22%, var(--bg-2))", speed: 0.15 },
  { seed: 21, base: 15, rough: 4, fill: "color-mix(in oklch, var(--accent) 18%, var(--surface))", speed: 0.3 },
  { seed: 42, base: 8, rough: 3, fill: "var(--bg)", speed: 0.5 },
];

/**
 * Layered pixel mountains for the bottom of the hero. Each layer moves at its own speed on scroll.
 */
export function Terrain() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38vh] min-h-56" aria-hidden="true">
      {layers.map((layer) => (
        <svg
          key={layer.seed}
          data-speed={layer.speed}
          viewBox="0 0 96 32"
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          className="terrain-layer absolute inset-x-0 bottom-0 h-full w-full"
        >
          <path d={steppedPath(layer.seed, 96, 32, layer.base, layer.rough)} fill={layer.fill} />
        </svg>
      ))}
    </div>
  );
}
