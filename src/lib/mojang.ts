import "server-only";

export type Player = { name: string; uuid: string | null; premium: boolean };

const NAME_PATTERN = /^\.?[A-Za-z0-9_]{2,16}$/;

export function isValidPlayerName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

function dashUuid(raw: string): string {
  const id = raw.replace(/-/g, "").toLowerCase();
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

async function lookup(url: string): Promise<{ id: string; name: string } | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; name?: string };
    return data.id && data.name ? { id: data.id, name: data.name } : null;
  } catch {
    return null;
  }
}

/**
 * Resolves a Java username to its Mojang profile. Bedrock names (starting with a dot)
 * and cracked names come back with premium = false and no UUID.
 */
export async function resolvePlayer(name: string): Promise<Player | null> {
  const trimmed = name.trim();
  if (!isValidPlayerName(trimmed)) return null;
  if (trimmed.startsWith(".")) return { name: trimmed, uuid: null, premium: false };

  const encoded = encodeURIComponent(trimmed);
  const profile =
    (await lookup(`https://api.mojang.com/users/profiles/minecraft/${encoded}`)) ??
    (await lookup(`https://api.minecraftservices.com/minecraft/profile/lookup/name/${encoded}`));

  if (!profile) return { name: trimmed, uuid: null, premium: false };
  return { name: profile.name, uuid: dashUuid(profile.id), premium: true };
}
