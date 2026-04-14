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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create internal order first so we have its ID for custom_id
    const order = await prisma.order.create({
      data: {
        companyId,
        amount: priceCents,
        paymentMethod: "paypal",
        status: "pending",
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    const returnUrl = `${appUrl}/api/checkout/paypal/return`;
    const cancelUrl = `${appUrl}/cancel`;

    const ppOrder = await createPayPalOrder(
      priceCents,
      "USD",
      returnUrl,
      cancelUrl,
      order.id
    );

    if (!ppOrder.id) {
      console.error("PayPal order creation failed:", ppOrder);
      await prisma.order.delete({ where: { id: order.id } });
      return NextResponse.json(
        { error: "Failed to create PayPal order" },
        { status: 500 }
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: ppOrder.id },
    });

    // Find approval URL (payer-action for redirect flow)
    const approveUrl =
      ppOrder.links?.find(
        (l: { rel: string; href: string }) => l.rel === "payer-action"
      )?.href ||
      ppOrder.links?.find(
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
