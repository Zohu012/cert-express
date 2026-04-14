import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendOrderConfirmationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { company: true },
      });

      if (order && order.status !== "completed") {
        const customerEmail = session.customer_details?.email || null;

        await prisma.order.update({
          where: { id: orderId },
          data: { status: "completed", customerEmail },
        });

        // Send confirmation email with download link
        if (customerEmail) {
          try {
            await sendOrderConfirmationEmail({
              to: customerEmail,
              companyName:    order.company.companyName,
              documentType:   order.company.documentType,
              documentNumber: order.company.documentNumber,
              serviceDate:    order.company.serviceDate,
              amountCents:    order.amount,
              downloadToken:  order.downloadToken,
              maxDownloads:   order.maxDownloads,
              expiresAt:      order.expiresAt,
            });
          } catch (emailErr) {
            // Don't fail the webhook if email fails
            console.error("[Stripe] Confirmation email failed:", emailErr);
          }
        }
      }
    }
  }

  return new Response("ok", { status: 200 });
}
