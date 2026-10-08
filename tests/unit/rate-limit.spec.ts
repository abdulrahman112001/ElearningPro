import { test, expect } from "@playwright/test"
import { rateLimit, getClientIp, tooManyRequests, isLocked, recordFailure, resetLimit } from "../../lib/rate-limit"

const uid = () => Math.random().toString(36).slice(2)

test.describe("rateLimit", () => {
  test("UT-20 allows exactly `limit` requests then blocks", () => {
    const id = uid()
    for (let i = 0; i < 5; i++) {
      const r = rateLimit({ identifier: id, scope: "t", limit: 5, windowMs: 60_000 })
      expect(r.success).toBe(true)
      expect(r.remaining).toBe(4 - i)
    }
    const blocked = rateLimit({ identifier: id, scope: "t", limit: 5, windowMs: 60_000 })
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  test("UT-21 scopes and identifiers are isolated", () => {
    const id = uid()
    rateLimit({ identifier: id, scope: "a", limit: 1, windowMs: 60_000 })
    expect(rateLimit({ identifier: id, scope: "a", limit: 1, windowMs: 60_000 }).success).toBe(false)
    expect(rateLimit({ identifier: id, scope: "b", limit: 1, windowMs: 60_000 }).success).toBe(true)
    expect(rateLimit({ identifier: uid(), scope: "a", limit: 1, windowMs: 60_000 }).success).toBe(true)
  })

  test("UT-22 window resets after windowMs", async () => {
    const id = uid()
    rateLimit({ identifier: id, scope: "w", limit: 1, windowMs: 50 })
    expect(rateLimit({ identifier: id, scope: "w", limit: 1, windowMs: 50 }).success).toBe(false)
    await new Promise((r) => setTimeout(r, 80))
    expect(rateLimit({ identifier: id, scope: "w", limit: 1, windowMs: 50 }).success).toBe(true)
  })
})

test.describe("getClientIp", () => {
  test.beforeEach(() => {
    process.env.TRUST_PROXY = "true"
  })
  test.afterEach(() => {
    delete process.env.TRUST_PROXY
  })

  test("UT-23 behind a trusted proxy, uses the first x-forwarded-for hop", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } })
    expect(getClientIp(req)).toBe("1.1.1.1")
  })

  test("UT-24 prefers x-real-ip, then falls back to unknown", () => {
    expect(getClientIp(new Request("http://x", { headers: { "x-real-ip": "3.3.3.3", "x-forwarded-for": "9.9.9.9" } }))).toBe("3.3.3.3")
    expect(getClientIp(new Request("http://x"))).toBe("unknown")
  })

  test("UT-26 without a trusted proxy, spoofed headers are ignored (AUTH-09)", () => {
    delete process.env.TRUST_PROXY
    const a = getClientIp(new Request("http://x", { headers: { "x-forwarded-for": "10.77.0.1" } }))
    const b = getClientIp(new Request("http://x", { headers: { "x-forwarded-for": "10.77.0.2", "x-real-ip": "1.2.3.4" } }))
    expect(a).toBe(b)
  })

  test("UT-27 rotating X-Forwarded-For does not escape the register limit (AUTH-09)", () => {
    delete process.env.TRUST_PROXY
    let throttled = false
    const scope = "ut27-" + uid()
    for (let i = 0; i < 8; i++) {
      const ip = getClientIp(new Request("http://x", { headers: { "x-forwarded-for": `10.77.0.${i}` } }))
      if (!rateLimit({ identifier: ip, scope, limit: 5, windowMs: 60_000 }).success) throttled = true
    }
    expect(throttled).toBe(true)
  })
})

test.describe("tooManyRequests", () => {
  test("UT-25 returns 429 with a positive Retry-After", async () => {
    const res = tooManyRequests(Date.now() + 30_000)
    expect(res.status).toBe(429)
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0)
    const body = await res.json()
    expect(body.error).toBeTruthy()
    expect(body.errorAr).toBeTruthy()
  })
})

test.describe("failure lockout", () => {
  test("UT-28 locks after N failures, reset clears it", () => {
    const id = uid()
    for (let i = 0; i < 3; i++) {
      expect(isLocked("lock", id, 3)).toBe(false)
      recordFailure("lock", id, 60_000)
    }
    expect(isLocked("lock", id, 3)).toBe(true)
    resetLimit("lock", id)
    expect(isLocked("lock", id, 3)).toBe(false)
  })
})
