import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, email } = await req.json();

  await prisma.company.update({
    where: { id },
    data: { email },
  });

  return NextResponse.json({ success: true });
}
