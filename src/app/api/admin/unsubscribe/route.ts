import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { addToUnsubscribeList, removeFromUnsubscribeList } from "@/lib/unsubscribe-list";

/** POST /api/admin/unsubscribe  { email: string }
 *  Adds email to the blocklist AND marks any matching Company rows. */
export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();
  const trimmed = typeof email === "string" ? email.trim() : "";
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  await addToUnsubscribeList(trimmed);
  const { count } = await prisma.company.updateMany({
    where: { email: trimmed },
    data: { emailStatus: "unsubscribed" },
  });

  return NextResponse.json({ ok: true, companiesUpdated: count });
}

/** DELETE /api/admin/unsubscribe?email=...  resubscribe / remove from blocklist */
export async function DELETE(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  await removeFromUnsubscribeList(email);
  await prisma.company.updateMany({
    where: { email, emailStatus: "unsubscribed" },
    data: { emailStatus: null },
  });
  return NextResponse.json({ ok: true });
}
