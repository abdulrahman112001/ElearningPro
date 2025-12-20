import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  typescript: true,
});

interface CreateCheckoutParams {
  userId: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  courseDescription?: string;
  courseThumbnail?: string;
  instructorId: string;
  amount: number;
  instructorEarnings: number;
  couponId?: string;
  courseSlug: string;
}

export async function createStripeCheckout({
  userId,
  userEmail,
  courseId,
  courseTitle,
  courseDescription,
  courseThumbnail,
  instructorId,
  amount,
  instructorEarnings,
  couponId,
  courseSlug,
}: CreateCheckoutParams) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "egp",
          product_data: {
            name: courseTitle,
            description: courseDescription?.slice(0, 200) || undefined,
            images: courseThumbnail ? [courseThumbnail] : undefined,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${courseSlug}`,
    metadata: {
      userId,
      courseId,
      instructorId,
      instructorEarnings: instructorEarnings.toString(),
      couponId: couponId || "",
    },
    customer_email: userEmail,
  });

  return session;
}

export async function retrieveCheckoutSession(sessionId: string) {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
}

export async function createPaymentIntent(amount: number, metadata: Record<string, string>) {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "egp",
    metadata,
  });
}

// For subscription-based courses or memberships
export async function createSubscription(customerId: string, priceId: string) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
  });
}

export async function createCustomer(email: string, name?: string) {
  return stripe.customers.create({
    email,
    name,
  });
}

export async function createRefund(paymentIntentId: string, amount?: number) {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amount ? Math.round(amount * 100) : undefined,
  });
}
