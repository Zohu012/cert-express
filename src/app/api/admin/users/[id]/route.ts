import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

// DELETE /api/admin/users/[id] — remove an admin user
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  // Prevent deleting yourself
  if (id === adminId) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  // Prevent deleting the last admin user
  const count = await prisma.adminUser.count();
  if (count <= 1) {
    return NextResponse.json({ error: "Cannot delete the last admin user" }, { status: 400 });
  }

  await prisma.adminUser.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
