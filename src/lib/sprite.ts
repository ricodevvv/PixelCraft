export type Sprite = { size: number; cells: (string | null)[] };

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function random(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a symmetric pixel sprite from any string. Same seed, same sprite, every time.
 * It's what products and categories show when they don't have an image.
 */
export function makeSprite(seed: string, hue?: number, size = 12): Sprite {
  const rand = random(hashString(seed));
  const baseHue = hue ?? Math.floor(rand() * 360);
  const accentHue = (baseHue + 40 + Math.floor(rand() * 80)) % 360;
  const half = Math.ceil(size / 2);
  const mask: boolean[] = new Array(size * size).fill(false);

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < half; x++) {
      const dx = (half - x) / half;
      const dy = Math.abs(y - size / 2) / (size / 2);
      const chance = 0.88 - dx * 0.55 - dy * 0.5;
      const filled = rand() < chance;
      mask[y * size + x] = filled;
      mask[y * size + (size - 1 - x)] = filled;
    }
  }

  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && mask[y * size + x];
  const cells: (string | null)[] = new Array(size * size).fill(null);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      if (mask[index]) {
        const shade = 72 - (y / size) * 34;
        const highlight = !at(x, y - 1) || !at(x - 1, y);
        const sparkle = rand() < 0.08;
        const h = sparkle ? accentHue : baseHue;
        const l = highlight ? shade + 12 : shade;
        cells[index] = `hsl(${h} ${sparkle ? 90 : 70}% ${Math.min(l, 88)}%)`;
      } else if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1)) {
        cells[index] = `hsl(${baseHue} 45% 12%)`;
      }
    }
  }
  return { size, cells };
}

export function spriteHue(seed: string): number {
  return hashString(seed) % 360;
}
