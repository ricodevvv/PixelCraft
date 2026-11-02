import { makeSprite } from "@/lib/sprite";

function texture(seed: string, hue: number): string {
  let state = 0;
  for (const char of seed) state = (state * 31 + char.charCodeAt(0)) >>> 0;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const rects: string[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const light = 46 + Math.floor(rand() * 26) - (y > 5 ? 8 : 0);
      const h = rand() < 0.1 ? hue + 40 : hue;
      rects.push(`<rect x='${x}' y='${y}' width='1' height='1' fill='hsl(${h} 70% ${light}%)'/>`);
    }
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'>${rects.join("")}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

function spriteTexture(seed: string, hue: number): string {
  const sprite = makeSprite(seed, hue, 10);
  const rects = sprite.cells
    .map((fill, index) =>
      fill ? `<rect x='${index % sprite.size}' y='${Math.floor(index / sprite.size)}' width='1' height='1' fill='${fill}'/>` : "",
    )
    .join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10' shape-rendering='crispEdges'><rect width='10' height='10' fill='hsl(${hue} 35% 16%)'/>${rects}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/**
 * A CSS 3D cube with procedurally generated pixel textures on each face.
 */
export function Voxel({ seed, hue, size, className = "", ore = false }: { seed: string; hue: number; size: number; className?: string; ore?: boolean }) {
  const faces = Array.from({ length: 6 }, (_, index) =>
    ore ? spriteTexture(`${seed}-${index % 2}`, hue) : texture(`${seed}-${index}`, hue),
  );
  return (
    <div className={`voxel ${className}`} style={{ "--size": `${size}px` } as React.CSSProperties}>
      {faces.map((background, index) => (
        <span key={index} style={{ backgroundImage: background }} />
      ))}
    </div>
  );
}
