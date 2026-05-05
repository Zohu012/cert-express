import { prisma } from "./db";

const TTL_MS = 60_000;
const cache = new Map<string, { value: Record<string, string>; expiresAt: number }>();

export async function getSettings(
  keys: string[]
): Promise<Record<string, string>> {
  const cacheKey = [...keys].sort().join("|");
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) return hit.value;

  const settings = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });
  const value = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  cache.set(cacheKey, { value, expiresAt: now + TTL_MS });
  return value;
}

export async function getSetting(key: string): Promise<string | null> {
  const result = await getSettings([key]);
  return result[key] ?? null;
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  cache.clear();
}

export async function getPriceCents(): Promise<number> {
  const result = await getSettings(["price_cents"]);
  const val = result.price_cents;
  return val ? parseInt(val, 10) : 3000;
}
