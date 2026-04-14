import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { capturePayPalOrder } from "@/lib/paypal";

/**
 * PayPal redirects here after the buyer approves payment.
 * URL params: ?token=PAYPAL_ORDER_ID&PayerID=PAYER_ID
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { searchParams } = new URL(req.url);
  const paypalOrderId = searchParams.get("token");

  if (!paypalOrderId) {
    return NextResponse.redirect(`${appUrl}/cancel`);
  }

  try {
    // Capture the payment
    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status !== "COMPLETED") {
      console.error("PayPal capture not completed:", capture);
      return NextResponse.redirect(`${appUrl}/cancel`);
    }

    // Find our internal order via paypalOrderId
    const order = await prisma.order.findFirst({
      where: { paymentId: paypalOrderId },
    });

    if (!order) {
      console.error("No internal order found for PayPal order:", paypalOrderId);
      return NextResponse.redirect(`${appUrl}/cancel`);
    }

    // Mark as completed
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "completed",
        customerEmail:
          capture.payment_source?.paypal?.email_address ||
          capture.payer?.email_address ||
          null,
      },
    });

    // Redirect to success page with download token
    return NextResponse.redirect(
      `${appUrl}/success?token=${order.downloadToken}`
    );
  } catch (error) {
    console.error("PayPal return handler error:", error);
    return NextResponse.redirect(`${appUrl}/cancel`);
  }
}
