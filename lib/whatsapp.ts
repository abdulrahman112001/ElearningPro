import { db } from "@/lib/db"

/**
 * Sends a WhatsApp text message and records it in MessageDelivery.
 *
 * Transport, first match wins:
 *   1. WHATSAPP_TRANSPORT=log            -> only logged (tests / local)
 *   2. WHATSAPP_TOKEN + WHATSAPP_PHONE_ID -> Meta WhatsApp Cloud API
 *   3. nothing configured                -> logged, status "LOGGED"
 * Never throws: messaging must not break the action that triggered it.
 */
export async function sendWhatsApp(input: {
  to: string
  text: string
  template: string
  userId?: string | null
}): Promise<{ ok: boolean; status: "SENT" | "LOGGED" | "FAILED"; error?: string }> {
  const to = normalizeEgyptianPhone(input.to)
  let status: "SENT" | "LOGGED" | "FAILED" = "LOGGED"
  let error: string | undefined

  if (!to) {
    status = "FAILED"
    error = "invalid phone number"
  } else if (
    process.env.WHATSAPP_TRANSPORT !== "log" &&
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_ID
  ) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: input.text.slice(0, 4096) },
          }),
        }
      )
      if (res.ok) status = "SENT"
      else {
        status = "FAILED"
        error = `WhatsApp API ${res.status}: ${(await res.text()).slice(0, 300)}`
      }
    } catch (e) {
      status = "FAILED"
      error = e instanceof Error ? e.message : String(e)
    }
  } else {
    console.log(`[whatsapp:log] to=${to ?? input.to} template=${input.template}`)
  }

  try {
    await db.messageDelivery.create({
      data: {
        channel: "WHATSAPP",
        to: to ?? input.to,
        template: input.template,
        body: input.text,
        status,
        error,
        userId: input.userId ?? null,
      },
    })
  } catch (e) {
    console.error("Failed to record WhatsApp delivery:", e)
  }

  return { ok: status !== "FAILED", status, error }
}

/** "01001234567" / "+20 100 123 4567" -> "201001234567"; null if unusable. */
export function normalizeEgyptianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/[^\d]/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("0") && digits.length === 11) digits = "2" + digits
  return digits.length >= 10 && digits.length <= 15 ? digits : null
}
