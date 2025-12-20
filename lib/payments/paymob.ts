/**
 * Paymob Payment Gateway Integration
 * For Egypt-based payments (cards, mobile wallets, etc.)
 */

const PAYMOB_API_URL = "https://accept.paymob.com/api";

interface PaymobConfig {
  apiKey: string;
  integrationId: string;
  iframeId: string;
  hmacSecret: string;
}

function getConfig(): PaymobConfig {
  return {
    apiKey: process.env.PAYMOB_API_KEY!,
    integrationId: process.env.PAYMOB_INTEGRATION_ID!,
    iframeId: process.env.PAYMOB_IFRAME_ID!,
    hmacSecret: process.env.PAYMOB_HMAC_SECRET!,
  };
}

export async function getPaymobAuthToken(): Promise<string> {
  const config = getConfig();
  
  const response = await fetch(`${PAYMOB_API_URL}/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.apiKey }),
  });

  if (!response.ok) {
    throw new Error("Failed to get Paymob auth token");
  }

  const data = await response.json();
  return data.token;
}

interface PaymobOrderParams {
  amount: number; // in cents (multiply EGP by 100)
  currency: string;
  merchantOrderId: string;
  items?: Array<{
    name: string;
    amount: number;
    quantity: number;
  }>;
}

export async function createPaymobOrder(
  authToken: string,
  params: PaymobOrderParams
): Promise<number> {
  const response = await fetch(`${PAYMOB_API_URL}/ecommerce/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: params.amount,
      currency: params.currency,
      merchant_order_id: params.merchantOrderId,
      items: params.items || [],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create Paymob order");
  }

  const data = await response.json();
  return data.id;
}

interface PaymentKeyParams {
  authToken: string;
  orderId: number;
  amount: number;
  currency: string;
  billingData: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    city?: string;
    country?: string;
    street?: string;
    building?: string;
    apartment?: string;
    floor?: string;
    postalCode?: string;
    shippingMethod?: string;
    state?: string;
  };
  metadata?: Record<string, string>;
}

export async function getPaymentKey(params: PaymentKeyParams): Promise<string> {
  const config = getConfig();
  
  const response = await fetch(`${PAYMOB_API_URL}/acceptance/payment_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: params.authToken,
      amount_cents: params.amount,
      expiration: 3600,
      order_id: params.orderId,
      currency: params.currency,
      integration_id: parseInt(config.integrationId),
      billing_data: {
        email: params.billingData.email,
        first_name: params.billingData.firstName,
        last_name: params.billingData.lastName,
        phone_number: params.billingData.phone,
        city: params.billingData.city || "NA",
        country: params.billingData.country || "EG",
        street: params.billingData.street || "NA",
        building: params.billingData.building || "NA",
        apartment: params.billingData.apartment || "NA",
        floor: params.billingData.floor || "NA",
        postal_code: params.billingData.postalCode || "NA",
        shipping_method: params.billingData.shippingMethod || "NA",
        state: params.billingData.state || "NA",
      },
      lock_order_when_paid: true,
      ...(params.metadata && { extras: params.metadata }),
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to get payment key");
  }

  const data = await response.json();
  return data.token;
}

export function getIframeUrl(paymentKey: string): string {
  const config = getConfig();
  return `https://accept.paymob.com/api/acceptance/iframes/${config.iframeId}?payment_token=${paymentKey}`;
}

// Verify HMAC signature from Paymob webhook
export function verifyHmac(data: any, receivedHmac: string): boolean {
  const crypto = require("crypto");
  const config = getConfig();
  
  const concatenatedString = [
    data.amount_cents,
    data.created_at,
    data.currency,
    data.error_occured,
    data.has_parent_transaction,
    data.id,
    data.integration_id,
    data.is_3d_secure,
    data.is_auth,
    data.is_capture,
    data.is_refunded,
    data.is_standalone_payment,
    data.is_voided,
    data.order?.id,
    data.owner,
    data.pending,
    data.source_data?.pan,
    data.source_data?.sub_type,
    data.source_data?.type,
    data.success,
  ].join("");

  const calculatedHmac = crypto
    .createHmac("sha512", config.hmacSecret)
    .update(concatenatedString)
    .digest("hex");

  return calculatedHmac === receivedHmac;
}

// Full checkout flow
export async function createPaymobCheckout(params: {
  amount: number;
  userEmail: string;
  userName: string;
  userPhone: string;
  courseId: string;
  userId: string;
  instructorId: string;
  instructorEarnings: number;
  couponId?: string;
}): Promise<string> {
  // Step 1: Get auth token
  const authToken = await getPaymobAuthToken();
  
  // Step 2: Create order
  const orderId = await createPaymobOrder(authToken, {
    amount: params.amount * 100, // Convert to cents
    currency: "EGP",
    merchantOrderId: `course_${params.courseId}_${Date.now()}`,
  });
  
  // Step 3: Get payment key
  const nameParts = params.userName.split(" ");
  const paymentKey = await getPaymentKey({
    authToken,
    orderId,
    amount: params.amount * 100,
    currency: "EGP",
    billingData: {
      email: params.userEmail,
      firstName: nameParts[0] || "User",
      lastName: nameParts.slice(1).join(" ") || "User",
      phone: params.userPhone || "+201000000000",
    },
    metadata: {
      userId: params.userId,
      courseId: params.courseId,
      instructorId: params.instructorId,
      instructorEarnings: params.instructorEarnings.toString(),
      couponId: params.couponId || "",
    },
  });
  
  // Step 4: Return iframe URL
  return getIframeUrl(paymentKey);
}
