import { APIRequestContext, request as pwRequest, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"

export const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3010"

export const ACCOUNTS = {
  admin: { email: "admin@elearning.com", password: "admin123" },
  ahmed: { email: "ahmed@elearning.com", password: "instructor123" },
  sara: { email: "sara@elearning.com", password: "instructor123" },
  student: { email: "student@elearning.com", password: "student123" },
} as const
export type Account = keyof typeof ACCOUNTS

export type Fixtures = {
  categoryId: string
  users: Record<Account, string>
  courses: {
    react: { id: string; slug: string; chapterIds: string[]; lessonIds: string[] }
    uiux: { id: string; slug: string; chapterIds: string[]; lessonIds: string[] }
    free: { id: string; slug: string }
    nextjs: { id: string; slug: string }
  }
  quizzes: {
    react: { id: string; lessonId: string; questionIds: string[] }
    timed: { id: string; lessonId: string; staleAttemptId: string; questionIds: string[] }
    sara: { id: string; lessonId: string }
  }
  withdrawals: { rejectThenComplete: string; race: string }
}

export function fixtures(): Fixtures {
  return JSON.parse(fs.readFileSync(path.join(__dirname, ".fixtures.json"), "utf8"))
}

let _db: PrismaClient | undefined
/** Direct DB handle for asserting side effects. Config guarantees it is local. */
export function db(): PrismaClient {
  return (_db ??= new PrismaClient())
}

/** Logs in through NextAuth's credentials endpoint and returns a cookie-carrying API client. */
export async function loginApi(email: string, password: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL })
  const csrf = await (await ctx.get("/api/auth/csrf")).json()
  await ctx.post("/api/auth/callback/credentials", {
    form: { email, password, csrfToken: csrf.csrfToken, callbackUrl: BASE_URL, json: "true" },
    maxRedirects: 0,
  })
  return ctx
}

export async function apiAs(who: Account): Promise<APIRequestContext> {
  const ctx = await loginApi(ACCOUNTS[who].email, ACCOUNTS[who].password)
  const s = await (await ctx.get("/api/auth/session")).json()
  expect(s?.user?.email, `login as ${who} failed`).toBe(ACCOUNTS[who].email)
  return ctx
}

export async function anon(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE_URL })
}

export function uniqueEmail(prefix = "user") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@qa.test`
}

/** Registers a throwaway account (cleaned up by global-setup on the next run). */
export async function registerUser(role: "STUDENT" | "INSTRUCTOR" = "STUDENT") {
  const email = uniqueEmail(role.toLowerCase())
  const password = "QaPass123!"
  const ctx = await anon()
  const res = await ctx.post("/api/auth/register", {
    data: { name: "QA User", email, password, role },
    headers: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
  })
  expect(res.status(), await res.text()).toBe(201)
  return { email, password, api: await loginApi(email, password) }
}

/** Marks a registered instructor as approved, as an admin would. */
export async function approveInstructor(email: string) {
  const user = await db().user.findUniqueOrThrow({ where: { email } })
  await db().instructorProfile.update({
    where: { userId: user.id },
    data: { isApproved: true, approvedAt: new Date(), applicationStatus: "APPROVED" },
  })
  return user.id
}

/** POSTs a raw (invalid) JSON body. */
export function rawJson(ctx: APIRequestContext, method: "post" | "patch" | "put", url: string) {
  // A Buffer is sent verbatim; a string would be JSON-encoded by Playwright.
  return ctx[method](url, { data: Buffer.from("{not json"), headers: { "content-type": "application/json" } })
}
