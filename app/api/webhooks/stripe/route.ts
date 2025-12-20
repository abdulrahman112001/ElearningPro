import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { sendEmail, emailTemplates } from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = headers().get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error: any) {
      console.error("Webhook signature verification failed:", error.message);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.succeeded":
        console.log("Payment succeeded:", event.data.object.id);
        break;

      case "payment_intent.payment_failed":
        console.log("Payment failed:", event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const { userId, courseId, instructorId, instructorEarnings, couponId } = session.metadata!;

  // Create purchase record
  const purchase = await db.purchase.create({
    data: {
      userId,
      courseId,
      amount: session.amount_total! / 100, // Convert from cents
      instructorEarnings: parseFloat(instructorEarnings),
      status: "COMPLETED",
      provider: "STRIPE",
      transactionId: session.payment_intent as string,
      couponId: couponId || null,
    },
  });

  // Create enrollment
  await db.enrollment.create({
    data: {
      userId,
      courseId,
    },
  });

  // Update instructor balance
  await db.user.update({
    where: { id: instructorId },
    data: {
      balance: {
        increment: parseFloat(instructorEarnings),
      },
    },
  });

  // Update coupon usage if applicable
  if (couponId) {
    await db.coupon.update({
      where: { id: couponId },
      data: {
        usedCount: { increment: 1 },
      },
    });
  }

  // Send confirmation email
  const user = await db.user.findUnique({ where: { id: userId } });
  const course = await db.course.findUnique({ where: { id: courseId } });

  if (user && course) {
    const template = emailTemplates.paymentSuccess(
      user.name || "User",
      session.amount_total! / 100,
      course.title
    );
    
    try {
      await sendEmail({
        to: user.email!,
        subject: template.subject,
        html: template.html,
      });
    } catch (error) {
      console.error("Failed to send confirmation email:", error);
    }
  }

  console.log("Purchase completed:", purchase.id);
}
