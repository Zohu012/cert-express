import type { NextRequest } from "next/server";

export function verifyPushToken(req: NextRequest): boolean {
  const expected = process.env.OTRUCKING_PUSH_TOKEN;
  if (!expected || expected.length < 16) return false;
  const header = req.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const presented = m[1].trim();
  if (presented.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ presented.charCodeAt(i);
  }
  return mismatch === 0;
}
