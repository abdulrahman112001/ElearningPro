import { test, expect } from "@playwright/test"
import { anon, apiAs, db, loginApi, rawJson, registerUser, uniqueEmail } from "./support"

const ip = () => ({ "x-forwarded-for": `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` })

test.describe("Registration", () => {
  test("AUTH-01 new student can register (201) and log in", async () => {
    const u = await registerUser("STUDENT")
    const s = await (await u.api.get("/api/auth/session")).json()
    expect(s.user.email).toBe(u.email)
    expect(s.user.role).toBe("STUDENT")
  })

  test("AUTH-02 duplicate email is rejected with 400", async () => {
    const ctx = await anon()
    const res = await ctx.post("/api/auth/register", {
      data: { name: "dup", email: "student@elearning.com", password: "123456" },
      headers: ip(),
    })
    expect(res.status()).toBe(400)
  })

  test("AUTH-03 password shorter than 6 chars is rejected", async () => {
    const ctx = await anon()
    const res = await ctx.post("/api/auth/register", {
      data: { name: "x", email: uniqueEmail(), password: "123" },
      headers: ip(),
    })
    expect(res.status()).toBe(400)
  })

  test("AUTH-04 missing fields / invalid email are rejected", async () => {
    const ctx = await anon()
    expect((await ctx.post("/api/auth/register", { data: { email: uniqueEmail() }, headers: ip() })).status()).toBe(400)
    expect((await ctx.post("/api/auth/register", { data: { name: "x", email: "not-an-email", password: "123456" }, headers: ip() })).status()).toBe(400)
  })

  test("AUTH-05 requesting role ADMIN at signup yields a STUDENT", async () => {
    const ctx = await anon()
    const email = uniqueEmail("escalate")
    const res = await ctx.post("/api/auth/register", {
      data: { name: "x", email, password: "123456", role: "ADMIN" },
      headers: ip(),
    })
    expect(res.status()).toBe(201)
    const user = await db().user.findUniqueOrThrow({ where: { email } })
    expect(user.role).toBe("STUDENT")
  })

  test("AUTH-06 @known-bug email is case-normalised (no duplicate account by casing)", async () => {
    const u = await registerUser()
    const upper = u.email.toUpperCase().replace("@QA.TEST", "@qa.test")
    const res = await (await anon()).post("/api/auth/register", {
      data: { name: "x", email: upper, password: "123456" },
      headers: ip(),
    })
    expect(res.status(), `a second account was created for ${upper}`).toBe(400)
  })

  test("AUTH-07 @known-bug malformed JSON body returns 400, not 500", async () => {
    const res = await rawJson(await anon(), "post", "/api/auth/register")
    expect(res.status()).toBe(400)
  })

  test("AUTH-08 register is rate-limited per IP (6th call in a minute => 429)", async () => {
    const ctx = await anon()
    const headers = { "x-forwarded-for": "10.200.200.200" }
    let last = 0
    for (let i = 0; i < 6; i++) {
      last = (await ctx.post("/api/auth/register", { data: { name: "x", email: "bad" }, headers })).status()
    }
    expect(last).toBe(429)
  })

  test("AUTH-09 @known-bug rate limit cannot be bypassed by rotating X-Forwarded-For", async () => {
    // The limiter keys on the client-supplied X-Forwarded-For header, so a
    // script that sends a fresh value per request is never throttled.
    const ctx = await anon()
    let throttled = false
    for (let i = 0; i < 8; i++) {
      const s = (await ctx.post("/api/auth/register", { data: { name: "x", email: "bad" }, headers: { "x-forwarded-for": `10.77.0.${i}` } })).status()
      if (s === 429) throttled = true
    }
    expect(throttled, "8 signups from one client were never throttled").toBe(true)
  })
})

test.describe("Login", () => {
  test("AUTH-10 valid credentials create a session for each role", async () => {
    for (const who of ["admin", "ahmed", "student"] as const) {
      await apiAs(who)
    }
  })

  test("AUTH-11 wrong password does not create a session", async () => {
    const ctx = await loginApi("student@elearning.com", "wrong-password")
    const s = await (await ctx.get("/api/auth/session")).json()
    expect(s?.user).toBeFalsy()
  })

  test("AUTH-12 @known-bug login is throttled after repeated failures (brute force)", async () => {
    const u = await registerUser("STUDENT")
    for (let i = 0; i < 20; i++) await loginApi(u.email, `wrong-${i}`)
    const ctx = await loginApi(u.email, u.password)
    const s = await (await ctx.get("/api/auth/session")).json()
    expect(s?.user, "20 wrong passwords in a row and the account still accepts logins with no throttling").toBeFalsy()
  })

  test("AUTH-13 blocked user cannot log in", async () => {
    const u = await registerUser("STUDENT")
    await db().user.update({ where: { email: u.email }, data: { isBlocked: true } })
    const ctx = await loginApi(u.email, u.password)
    const s = await (await ctx.get("/api/auth/session")).json()
    expect(s?.user).toBeFalsy()
  })

  test("AUTH-14 @known-bug blocking a user ends their existing session", async () => {
    const u = await registerUser("STUDENT")
    expect((await u.api.get("/api/user/profile")).status()).toBe(200)
    const admin = await apiAs("admin")
    const user = await db().user.findUniqueOrThrow({ where: { email: u.email } })
    const r = await admin.patch(`/api/admin/users/${user.id}`, { data: { isBlocked: true } })
    expect(r.status(), await r.text()).toBe(200)
    expect((await u.api.get("/api/user/profile")).status(), "blocked user's JWT still works").toBe(401)
  })
})

test.describe("Password reset", () => {
  test("AUTH-15 @known-bug forgot-password gives the same answer for known and unknown emails", async () => {
    const ctx = await anon()
    const known = await (await ctx.post("/api/auth/forgot-password", { data: { email: "student@elearning.com" }, headers: ip() })).json()
    const unknown = await (await ctx.post("/api/auth/forgot-password", { data: { email: uniqueEmail("ghost") }, headers: ip() })).json()
    expect(known.message, "response reveals whether an account exists").toBe(unknown.message)
  })

  test("AUTH-16 reset-password rejects an invalid token", async () => {
    const res = await (await anon()).post("/api/auth/reset-password", { data: { token: "deadbeef", password: "newpass123" } })
    expect(res.status()).toBe(400)
  })

  test("AUTH-17 validate-reset-token rejects missing and bogus tokens", async () => {
    const ctx = await anon()
    expect((await ctx.get("/api/auth/validate-reset-token")).status()).toBe(400)
    expect((await ctx.get("/api/auth/validate-reset-token?token=nope")).status()).toBe(400)
  })
})

test.describe("Change password", () => {
  test("AUTH-18 wrong current password is rejected", async () => {
    const u = await registerUser("STUDENT")
    const res = await u.api.post("/api/user/password", {
      data: { currentPassword: "nope-nope", newPassword: "abcdef1", confirmPassword: "abcdef1" },
    })
    expect(res.status()).toBe(400)
  })

  test("AUTH-19 correct current password changes it (POST)", async () => {
    const u = await registerUser("STUDENT")
    const res = await u.api.post("/api/user/password", {
      data: { currentPassword: u.password, newPassword: "Changed123", confirmPassword: "Changed123" },
    })
    expect(res.status(), await res.text()).toBe(200)
    const s = await (await (await loginApi(u.email, "Changed123")).get("/api/auth/session")).json()
    expect(s?.user?.email).toBe(u.email)
  })

  test("AUTH-20 @known-bug the settings form's PATCH request is accepted", async () => {
    // components/settings/password-form.tsx sends PATCH; the route only exports POST.
    const u = await registerUser("STUDENT")
    const res = await u.api.patch("/api/user/password", {
      data: { currentPassword: u.password, newPassword: "Changed123", confirmPassword: "Changed123" },
    })
    expect(res.status(), "UI change-password request gets 405").not.toBe(405)
  })
})

test.describe("Profile", () => {
  test("AUTH-21 profile PATCH cannot change role or email (mass assignment)", async () => {
    const u = await registerUser("STUDENT")
    const res = await u.api.patch("/api/user/profile", { data: { name: "Renamed", role: "ADMIN", email: "hijack@qa.test" } })
    expect(res.status()).toBe(200)
    const user = await db().user.findUniqueOrThrow({ where: { email: u.email } })
    expect(user.role).toBe("STUDENT")
    expect(user.name).toBe("Renamed")
  })
})
