/**
 * Tap Payment Gateway Integration
 * For Gulf region payments (Saudi Arabia, UAE, Kuwait, Bahrain, Oman, Qatar)
 */

const TAP_API_URL = "https://api.tap.company/v2";

function getConfig() {
  return {
    secretKey: process.env.TAP_SECRET_KEY!,
    publishableKey: process.env.TAP_PUBLISHABLE_KEY!,
  };
}

function getHeaders() {
  const config = getConfig();
  return {
    "Authorization": `Bearer ${config.secretKey}`,
    "Content-Type": "application/json",
  };
}

interface TapChargeParams {
  amount: number;
  currency: "SAR" | "AED" | "KWD" | "BHD" | "OMR" | "QAR" | "EGP";
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  description?: string;
  metadata?: Record<string, string>;
  redirectUrl: string;
}

export async function createTapCharge(params: TapChargeParams): Promise<{
  id: string;
  status: string;
  redirectUrl: string;
}> {
  const nameParts = params.customerName.split(" ");
  
  const response = await fetch(`${TAP_API_URL}/charges`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      threeDSecure: true,
      save_card: false,
      description: params.description || "Course Purchase",
      statement_descriptor: "E-Learning Platform",
      metadata: params.metadata || {},
      reference: {
        transaction: `txn_${Date.now()}`,
        order: `order_${Date.now()}`,
      },
      receipt: {
        email: true,
        sms: false,
      },
      customer: {
        first_name: nameParts[0] || "Customer",
        last_name: nameParts.slice(1).join(" ") || "",
        email: params.customerEmail,
        phone: params.customerPhone ? {
          country_code: "+20",
          number: params.customerPhone.replace(/^\+?20/, ""),
        } : undefined,
      },
      source: {
        id: "src_all", // Accept all payment methods
      },
      redirect: {
        url: params.redirectUrl,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create Tap charge");
  }

  const data = await response.json();
  
  return {
    id: data.id,
    status: data.status,
    redirectUrl: data.transaction?.url || "",
  };
}

export async function retrieveTapCharge(chargeId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  customer: {
    email: string;
    name: string;
  };
}> {
  const response = await fetch(`${TAP_API_URL}/charges/${chargeId}`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to retrieve Tap charge");
  }

  const data = await response.json();
  
  return {
    id: data.id,
    status: data.status,
    amount: data.amount,
    currency: data.currency,
    metadata: data.metadata || {},
    customer: {
      email: data.customer?.email || "",
      name: `${data.customer?.first_name || ""} ${data.customer?.last_name || ""}`.trim(),
    },
  };
}

export async function createTapRefund(chargeId: string, amount?: number): Promise<{
  id: string;
  status: string;
  amount: number;
}> {
  const response = await fetch(`${TAP_API_URL}/refunds`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      charge_id: chargeId,
      amount: amount,
      reason: "requested_by_customer",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create refund");
  }

  const data = await response.json();
  
  return {
    id: data.id,
    status: data.status,
    amount: data.amount,
  };
}

// Full checkout flow
export async function createTapCheckout(params: {
  amount: number;
  currency: "SAR" | "AED" | "KWD" | "BHD" | "OMR" | "QAR" | "EGP";
  userEmail: string;
  userName: string;
  userPhone?: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  userId: string;
  instructorId: string;
  instructorEarnings: number;
  couponId?: string;
}): Promise<string> {
  const charge = await createTapCharge({
    amount: params.amount,
    currency: params.currency,
    customerEmail: params.userEmail,
    customerName: params.userName,
    customerPhone: params.userPhone,
    description: `Purchase: ${params.courseTitle}`,
    metadata: {
      userId: params.userId,
      courseId: params.courseId,
      instructorId: params.instructorId,
      instructorEarnings: params.instructorEarnings.toString(),
      couponId: params.couponId || "",
    },
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/tap/callback?course=${params.courseSlug}`,
  });

  return charge.redirectUrl;
}

// Webhook signature verification
export function verifyTapWebhook(payload: string, signature: string): boolean {
  const crypto = require("crypto");
  const config = getConfig();
  
  const calculatedSignature = crypto
    .createHmac("sha256", config.secretKey)
    .update(payload)
    .digest("hex");

  return calculatedSignature === signature;
}
