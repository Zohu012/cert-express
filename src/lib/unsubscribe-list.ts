import { getSetting, setSetting } from "./settings";

const KEY = "email_blocklist";

/** Parse the JSON blocklist from settings. Returns a lowercased string[]. */
export async function getUnsubscribeList(): Promise<string[]> {
  const raw = await getSetting(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((e) => String(e).toLowerCase());
  } catch {}
  return [];
}

/** Add an email to the blocklist. Idempotent. */
export async function addToUnsubscribeList(email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e) return;
  const list = await getUnsubscribeList();
  if (list.includes(e)) return;
  list.push(e);
  await setSetting(KEY, JSON.stringify(list));
}

/** Remove an email from the blocklist. */
export async function removeFromUnsubscribeList(email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e) return;
  const list = await getUnsubscribeList();
  const next = list.filter((x) => x !== e);
  if (next.length === list.length) return;
  await setSetting(KEY, JSON.stringify(next));
}

/** O(1) membership check. */
export async function isUnsubscribed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const list = await getUnsubscribeList();
  return list.includes(email.trim().toLowerCase());
}
