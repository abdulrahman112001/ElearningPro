/**
 * PayPal Payment Gateway Integration
 */

const PAYPAL_API_URL = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

function getConfig() {
  return {
    clientId: process.env.PAYPAL_CLIENT_ID!,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
  };
}

async function getAccessToken(): Promise<string> {
  const config = getConfig();
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  
  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  return data.access_token;
}

interface PayPalOrderParams {
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export async function createPayPalOrder(params: PayPalOrderParams): Promise<{
  id: string;
  approvalUrl: string;
}> {
  const accessToken = await getAccessToken();
  
  const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: params.currency,
            value: params.amount.toFixed(2),
          },
          description: params.description,
          custom_id: params.metadata ? JSON.stringify(params.metadata) : undefined,
        },
      ],
      application_context: {
        brand_name: "E-Learning Platform",
        landing_page: "LOGIN",
        user_action: "PAY_NOW",
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create PayPal order");
  }

  const data = await response.json();
  
  const approvalLink = data.links.find((link: any) => link.rel === "approve");
  
  return {
    id: data.id,
    approvalUrl: approvalLink?.href || "",
  };
}

export async function capturePayPalOrder(orderId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
  payer: {
    email: string;
    name: string;
  };
}> {
  const accessToken = await getAccessToken();
  
  const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to capture PayPal order");
  }

  const data = await response.json();
  const capture = data.purchase_units[0]?.payments?.captures?.[0];
  
  let metadata: Record<string, string> | undefined;
  try {
    const customId = data.purchase_units[0]?.custom_id;
    if (customId) {
      metadata = JSON.parse(customId);
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  return {
    id: data.id,
    status: data.status,
    amount: parseFloat(capture?.amount?.value || "0"),
    currency: capture?.amount?.currency_code || "USD",
    metadata,
    payer: {
      email: data.payer?.email_address || "",
      name: `${data.payer?.name?.given_name || ""} ${data.payer?.name?.surname || ""}`.trim(),
    },
  };
}

export async function createPayPalRefund(captureId: string, amount?: number): Promise<{
  id: string;
  status: string;
}> {
  const accessToken = await getAccessToken();
  
  const body: any = {};
  if (amount) {
    body.amount = {
      currency_code: "USD",
      value: amount.toFixed(2),
    };
  }
  
  const response = await fetch(`${PAYPAL_API_URL}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Failed to create PayPal refund");
  }

  const data = await response.json();
  
  return {
    id: data.id,
    status: data.status,
  };
}

// Full checkout flow
export async function createPayPalCheckout(params: {
  amount: number;
  currency: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  userId: string;
  instructorId: string;
  instructorEarnings: number;
  couponId?: string;
}): Promise<string> {
  const order = await createPayPalOrder({
    amount: params.amount,
    currency: params.currency,
    description: `Course: ${params.courseTitle}`,
    returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/paypal/callback?course=${params.courseSlug}`,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${params.courseSlug}`,
    metadata: {
      userId: params.userId,
      courseId: params.courseId,
      instructorId: params.instructorId,
      instructorEarnings: params.instructorEarnings.toString(),
      couponId: params.couponId || "",
    },
  });

  return order.approvalUrl;
}

// Webhook signature verification
export async function verifyPayPalWebhook(
  webhookId: string,
  eventBody: any,
  headers: Record<string, string>
): Promise<boolean> {
  const accessToken = await getAccessToken();
  
  const response = await fetch(`${PAYPAL_API_URL}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: eventBody,
    }),
  });

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return data.verification_status === "SUCCESS";
}
