import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { capturePayPalOrder } from "@/lib/paypal";

export async function POST(req: NextRequest) {
  try {
    const { paypalOrderId } = await req.json();

    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status === "COMPLETED") {
      const order = await prisma.order.findFirst({
        where: { paymentId: paypalOrderId },
      });

      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "completed",
            customerEmail:
              capture.payer?.email_address || null,
          },
        });

        return NextResponse.json({
          success: true,
          downloadToken: order.downloadToken,
        });
      }
    }

    return NextResponse.json(
      { error: "Payment capture failed" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PayPal capture error:", error);
    return NextResponse.json(
      { error: "Failed to capture payment" },
      { status: 500 }
    );
  }
}
