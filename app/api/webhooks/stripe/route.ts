import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
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
  const {
    userId,
    courseId,
    instructorId,
    instructorShare,
    platformShare,
    discountAmount,
    couponId,
  } = session.metadata!;

  const transactionId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? session.id;

  const instructorShareValue = parseFloat(instructorShare || "0");
  const platformShareValue = parseFloat(platformShare || "0");
  const discountValue = parseFloat(discountAmount || "0");

  // Purchase.providerId is unique, so a duplicate or concurrent delivery of
  // the same event fails on the first insert and rolls back the whole
  // transaction. Nothing is credited twice.
  let purchase;
  try {
    purchase = await db.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          userId,
          courseId,
          amount: session.amount_total! / 100, // Convert from cents
          provider: "STRIPE",
          providerId: transactionId,
          status: "COMPLETED",
          instructorShare: instructorShareValue,
          platformShare: platformShareValue,
          discountAmount: discountValue,
          couponId: couponId || null,
        },
      });

      // The user may already be enrolled (e.g. paid twice, or enrolled by an
      // admin). The payment is still recorded instead of failing forever.
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        update: {},
        create: { userId, courseId },
      });

      await tx.instructorProfile.upsert({
        where: { userId: instructorId },
        update: {
          pendingEarnings: { increment: instructorShareValue },
          totalEarnings: { increment: instructorShareValue },
        },
        create: {
          userId: instructorId,
          pendingEarnings: instructorShareValue,
          totalEarnings: instructorShareValue,
        },
      });

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.log("Webhook already processed:", transactionId);
      return;
    }
    throw error;
  }

  // Send confirmation email
  const user = await db.user.findUnique({ where: { id: userId } });
  const course = await db.course.findUnique({ where: { id: courseId } });

  if (user && course) {
    const template = emailTemplates.paymentSuccess(
      user.name || "User",
      session.amount_total! / 100,
      course.titleEn
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
