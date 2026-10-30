import { makeSprite } from "@/lib/sprite";

type Props = { seed: string; hue?: number; className?: string; size?: number };

/**
 * Renders the deterministic sprite for a seed as a crisp SVG.
 */
export function PixelSprite({ seed, hue, className, size = 12 }: Props) {
  const sprite = makeSprite(seed, hue, size);
  return (
    <svg
      viewBox={`0 0 ${sprite.size} ${sprite.size}`}
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {sprite.cells.map((fill, index) =>
        fill ? (
          <rect key={index} x={index % sprite.size} y={Math.floor(index / sprite.size)} width={1.02} height={1.02} fill={fill} />
        ) : null,
      )}
    </svg>
  );
}
