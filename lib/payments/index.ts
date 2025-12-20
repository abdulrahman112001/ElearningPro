/**
 * Payment Gateway Facade
 * Unified interface for all payment providers
 */

export { stripe, createStripeCheckout, retrieveCheckoutSession, createRefund as createStripeRefund } from "./stripe";
export { createPaymobCheckout, verifyHmac as verifyPaymobWebhook } from "./paymob";
export { createTapCheckout, retrieveTapCharge, createTapRefund, verifyTapWebhook } from "./tap";
export { createPayPalCheckout, capturePayPalOrder, createPayPalRefund, verifyPayPalWebhook } from "./paypal";

export type PaymentProvider = "stripe" | "paypal" | "paymob" | "tap";

export interface PaymentResult {
  success: boolean;
  redirectUrl?: string;
  transactionId?: string;
  error?: string;
}

export interface CheckoutParams {
  provider: PaymentProvider;
  amount: number;
  currency: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  courseThumbnail?: string;
  courseDescription?: string;
  instructorId: string;
  instructorEarnings: number;
  couponId?: string;
}

/**
 * Unified checkout function that routes to appropriate payment provider
 */
export async function createCheckout(params: CheckoutParams): Promise<PaymentResult> {
  try {
    let redirectUrl: string;

    switch (params.provider) {
      case "stripe":
        const { createStripeCheckout } = await import("./stripe");
        const session = await createStripeCheckout({
          userId: params.userId,
          userEmail: params.userEmail,
          courseId: params.courseId,
          courseTitle: params.courseTitle,
          courseDescription: params.courseDescription,
          courseThumbnail: params.courseThumbnail,
          instructorId: params.instructorId,
          amount: params.amount,
          instructorEarnings: params.instructorEarnings,
          couponId: params.couponId,
          courseSlug: params.courseSlug,
        });
        redirectUrl = session.url!;
        break;

      case "paypal":
        const { createPayPalCheckout } = await import("./paypal");
        redirectUrl = await createPayPalCheckout({
          amount: params.amount,
          currency: params.currency,
          courseId: params.courseId,
          courseTitle: params.courseTitle,
          courseSlug: params.courseSlug,
          userId: params.userId,
          instructorId: params.instructorId,
          instructorEarnings: params.instructorEarnings,
          couponId: params.couponId,
        });
        break;

      case "paymob":
        const { createPaymobCheckout } = await import("./paymob");
        redirectUrl = await createPaymobCheckout({
          amount: params.amount,
          userEmail: params.userEmail,
          userName: params.userName,
          userPhone: params.userPhone || "",
          courseId: params.courseId,
          userId: params.userId,
          instructorId: params.instructorId,
          instructorEarnings: params.instructorEarnings,
          couponId: params.couponId,
        });
        break;

      case "tap":
        const { createTapCheckout } = await import("./tap");
        redirectUrl = await createTapCheckout({
          amount: params.amount,
          currency: params.currency as any,
          userEmail: params.userEmail,
          userName: params.userName,
          userPhone: params.userPhone,
          courseId: params.courseId,
          courseTitle: params.courseTitle,
          courseSlug: params.courseSlug,
          userId: params.userId,
          instructorId: params.instructorId,
          instructorEarnings: params.instructorEarnings,
          couponId: params.couponId,
        });
        break;

      default:
        return {
          success: false,
          error: "Invalid payment provider",
        };
    }

    return {
      success: true,
      redirectUrl,
    };
  } catch (error: any) {
    console.error("Checkout error:", error);
    return {
      success: false,
      error: error.message || "Failed to create checkout",
    };
  }
}

/**
 * Get supported currencies for each provider
 */
export function getSupportedCurrencies(provider: PaymentProvider): string[] {
  switch (provider) {
    case "stripe":
      return ["EGP", "USD", "EUR", "GBP", "SAR", "AED"];
    case "paypal":
      return ["USD", "EUR", "GBP", "CAD", "AUD"];
    case "paymob":
      return ["EGP"];
    case "tap":
      return ["SAR", "AED", "KWD", "BHD", "OMR", "QAR", "EGP"];
    default:
      return [];
  }
}

/**
 * Get payment provider label
 */
export function getProviderLabel(provider: PaymentProvider): string {
  switch (provider) {
    case "stripe":
      return "Credit Card";
    case "paypal":
      return "PayPal";
    case "paymob":
      return "Paymob (Egypt)";
    case "tap":
      return "Tap (Gulf)";
    default:
      return provider;
  }
}
