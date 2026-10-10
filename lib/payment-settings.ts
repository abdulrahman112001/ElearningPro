import { db } from "@/lib/db"

/** Where students send manual transfers; edited by admins on /admin/manual-payments. */
export const PAYMENT_SETTING_KEYS = {
  vodafoneCashNumber: "payments.vodafoneCashNumber",
  instapayAddress: "payments.instapayAddress",
  bankDetails: "payments.bankDetails",
} as const

export type PaymentSettings = Record<keyof typeof PAYMENT_SETTING_KEYS, string>

export const MANUAL_PAYMENT_METHODS = ["VODAFONE_CASH", "INSTAPAY", "BANK_TRANSFER", "FAWRY"] as const
export const MIN_TOPUP = 10
export const MAX_TOPUP = 20000

function unwrap(value: string): string {
  // The generic admin settings API stores JSON-encoded strings; accept both.
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === "string") return parsed
  } catch {}
  return value
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.values(PAYMENT_SETTING_KEYS) } } })
  const byKey = new Map(rows.map((r) => [r.key, unwrap(r.value)]))
  return {
    vodafoneCashNumber: byKey.get(PAYMENT_SETTING_KEYS.vodafoneCashNumber) ?? "",
    instapayAddress: byKey.get(PAYMENT_SETTING_KEYS.instapayAddress) ?? "",
    bankDetails: byKey.get(PAYMENT_SETTING_KEYS.bankDetails) ?? "",
  }
}

export async function savePaymentSettings(input: Partial<PaymentSettings>) {
  const entries = (Object.keys(PAYMENT_SETTING_KEYS) as (keyof PaymentSettings)[])
    .filter((k) => typeof input[k] === "string")
    .map((k) => {
      const value = (input[k] as string).trim().slice(0, k === "bankDetails" ? 1000 : 200)
      return db.setting.upsert({
        where: { key: PAYMENT_SETTING_KEYS[k] },
        update: { value },
        create: { key: PAYMENT_SETTING_KEYS[k], value },
      })
    })
  await db.$transaction(entries)
  return getPaymentSettings()
}

/** Reference numbers compared case/space-insensitively for duplicate detection. */
export function normalizeReference(ref: string) {
  return ref.toUpperCase().replace(/[\s\-_.#]/g, "")
}
