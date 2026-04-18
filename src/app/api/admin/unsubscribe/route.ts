import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

/** POST /api/admin/unsubscribe  { email: string }
 *  Marks all companies with that email as unsubscribed. */
export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { count } = await prisma.company.updateMany({
    where: { email: email.trim().toLowerCase() },
    data: { emailStatus: "unsubscribed" },
  });

  return NextResponse.json({ count });
}
