import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    if (event.event_type === "CHECKOUT.ORDER.APPROVED" || event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const paypalOrderId = event.resource?.id || event.resource?.supplementary_data?.related_ids?.order_id;

      if (paypalOrderId) {
        const order = await prisma.order.findFirst({
          where: { paymentId: paypalOrderId },
        });

        if (order && order.status !== "completed") {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: "completed" },
          });
        }
      }
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return new Response("error", { status: 500 });
  }
}
