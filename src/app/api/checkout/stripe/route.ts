import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
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

    // Create order first
    const order = await prisma.order.create({
      data: {
        companyId,
        amount: priceCents,
        paymentMethod: "stripe",
        status: "pending",
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `FMCSA ${company.documentType} - ${company.documentNumber}`,
              description: `Certificate for ${company.companyName}`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${appUrl}/success?token=${order.downloadToken}`,
      cancel_url: `${appUrl}/cancel`,
      metadata: {
        orderId: order.id,
        companyId: company.id,
      },
    });

    // Store stripe session ID
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
