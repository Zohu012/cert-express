import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

// PATCH /api/orders/[id]  — edit an order
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await verifySession();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const { status, customerEmail, maxDownloads, downloadCount, expiresAt, notes } =
    body;

  try {
    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (customerEmail !== undefined) data.customerEmail = customerEmail || null;
    if (maxDownloads !== undefined) data.maxDownloads = Number(maxDownloads);
    if (downloadCount !== undefined) data.downloadCount = Number(downloadCount);
    if (expiresAt !== undefined) data.expiresAt = new Date(expiresAt);

    const order = await prisma.order.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    console.error("Order update error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// DELETE /api/orders/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await verifySession();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await prisma.order.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Order delete error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
