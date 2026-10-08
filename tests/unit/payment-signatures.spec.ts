import { test, expect } from "@playwright/test"
import crypto from "crypto"

process.env.PAYMOB_HMAC_SECRET = "unit-test-paymob-secret"
process.env.TAP_SECRET_KEY = "unit-test-tap-secret"

// Loaded after the env vars above so getConfig() picks up the test secrets.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { verifyHmac } = require("../../lib/payments/paymob")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { verifyTapWebhook } = require("../../lib/payments/tap")

const paymobTxn = {
  amount_cents: 19900,
  created_at: "2026-10-08T10:00:00",
  currency: "EGP",
  error_occured: false,
  has_parent_transaction: false,
  id: 123,
  integration_id: 456,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: true,
  is_voided: false,
  order: { id: 789 },
  owner: 1,
  pending: false,
  source_data: { pan: "2346", sub_type: "MasterCard", type: "card" },
  success: true,
}

function paymobSign(d: typeof paymobTxn, secret: string) {
  const s = [
    d.amount_cents, d.created_at, d.currency, d.error_occured, d.has_parent_transaction,
    d.id, d.integration_id, d.is_3d_secure, d.is_auth, d.is_capture, d.is_refunded,
    d.is_standalone_payment, d.is_voided, d.order.id, d.owner, d.pending,
    d.source_data.pan, d.source_data.sub_type, d.source_data.type, d.success,
  ].join("")
  return crypto.createHmac("sha512", secret).update(s).digest("hex")
}

test.describe("Paymob HMAC", () => {
  test("UT-30 accepts a correctly signed transaction", () => {
    expect(verifyHmac(paymobTxn, paymobSign(paymobTxn, "unit-test-paymob-secret"))).toBe(true)
  })

  test("UT-31 rejects a tampered amount", () => {
    const sig = paymobSign(paymobTxn, "unit-test-paymob-secret")
    expect(verifyHmac({ ...paymobTxn, amount_cents: 1 }, sig)).toBe(false)
  })

  test("UT-32 rejects a signature made with another secret", () => {
    expect(verifyHmac(paymobTxn, paymobSign(paymobTxn, "attacker"))).toBe(false)
  })

  test("UT-33 rejects an empty signature", () => {
    expect(verifyHmac(paymobTxn, "")).toBe(false)
  })
})

test.describe("Tap webhook signature", () => {
  const payload = JSON.stringify({ id: "chg_1", status: "CAPTURED", amount: 199 })
  const good = crypto.createHmac("sha256", "unit-test-tap-secret").update(payload).digest("hex")

  test("UT-34 accepts a valid signature", () => {
    expect(verifyTapWebhook(payload, good)).toBe(true)
  })

  test("UT-35 rejects a modified payload", () => {
    expect(verifyTapWebhook(payload.replace("199", "1"), good)).toBe(false)
  })
})
