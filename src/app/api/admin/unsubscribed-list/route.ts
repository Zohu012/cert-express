import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unsubscribed = await prisma.company.findMany({
    where: { emailStatus: "unsubscribed" },
    select: {
      id: true,
      companyName: true,
      email: true,
      usdotNumber: true,
      documentType: true,
      emailSentAt: true,
    },
    orderBy: { emailSentAt: "desc" },
  });

  return NextResponse.json(unsubscribed);
}
