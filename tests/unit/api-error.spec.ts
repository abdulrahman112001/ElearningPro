import { test, expect } from "@playwright/test"
import { Prisma } from "@prisma/client"
import { ApiError, apiErrorResponse, readJson } from "../../lib/api-error"
import { generateCertificateNumber } from "../../lib/certificates"

const req = (body: string) => new Request("http://x", { method: "POST", body, headers: { "content-type": "application/json" } })

test.describe("readJson", () => {
  test("UT-40 parses valid JSON", async () => {
    expect(await readJson(req('{"a":1}'))).toEqual({ a: 1 })
  })

  test("UT-41 empty body is an empty object", async () => {
    expect(await readJson(req(""))).toEqual({})
  })

  test("UT-42 malformed JSON throws a 400 ApiError", async () => {
    const err = await readJson(req("{not json")).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(400)
  })
})

test.describe("apiErrorResponse", () => {
  const known = (code: string) =>
    new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "5" })

  test("UT-43 maps ApiError to its status and message", async () => {
    const res = apiErrorResponse(new ApiError(409, "dup", { errorAr: "مكرر" }))!
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "dup", errorAr: "مكرر" })
  })

  test("UT-44 maps Prisma not-found / FK / unique / validation errors", () => {
    expect(apiErrorResponse(known("P2025"))!.status).toBe(404)
    expect(apiErrorResponse(known("P2003"))!.status).toBe(404)
    expect(apiErrorResponse(known("P2002"))!.status).toBe(409)
    expect(apiErrorResponse(new Prisma.PrismaClientValidationError("bad", { clientVersion: "5" }))!.status).toBe(400)
  })

  test("UT-45 leaves unknown errors to the caller (500 path)", () => {
    expect(apiErrorResponse(new Error("boom"))).toBeNull()
    expect(apiErrorResponse(known("P1001"))).toBeNull()
  })
})

test.describe("certificate numbers", () => {
  test("UT-46 one format, unguessable random part, no collisions", () => {
    const set = new Set(Array.from({ length: 2000 }, () => generateCertificateNumber()))
    expect(set.size).toBe(2000)
    for (const n of Array.from(set).slice(0, 20)) expect(n).toMatch(/^CERT-[0-9A-Z]+-[0-9A-F]{8}$/)
  })
})
