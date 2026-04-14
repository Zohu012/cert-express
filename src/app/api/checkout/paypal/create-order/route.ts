import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPayPalOrder } from "@/lib/paypal";
import { getPriceCents } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json();

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const priceCents = await getPriceCents();

    const order = await prisma.order.create({
      data: {
        companyId,
        amount: priceCents,
        paymentMethod: "paypal",
        status: "pending",
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    const ppOrder = await createPayPalOrder(priceCents, "USD");

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: ppOrder.id },
    });

    // Find approval URL
    const approveUrl = ppOrder.links?.find(
      (l: { rel: string; href: string }) => l.rel === "approve"
    )?.href;

    return NextResponse.json({
      paypalOrderId: ppOrder.id,
      approveUrl,
      orderId: order.id,
    });
  } catch (error) {
    console.error("PayPal create order error:", error);
    return NextResponse.json(
      { error: "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}
