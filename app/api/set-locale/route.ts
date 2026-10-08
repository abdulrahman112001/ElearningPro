import { NextRequest, NextResponse } from "next/server"

const LOCALES = ["ar", "en"] as const

/**
 * GET /api/set-locale?locale=en&redirect=/courses
 * Sets the `locale` cookie and returns to the page the user was on. Works
 * without JavaScript (e.g. a plain link), complementing the navbar switcher.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const requested = searchParams.get("locale")
  const locale = (LOCALES as readonly string[]).includes(requested ?? "")
    ? (requested as (typeof LOCALES)[number])
    : "ar"

  // Only same-site relative paths, so the endpoint cannot be used as an open
  // redirect ("//evil.com" and absolute URLs fall back to the referer or "/").
  const isSafePath = (p: string | null): p is string =>
    !!p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\")
  let target = searchParams.get("redirect")
  if (!isSafePath(target)) {
    const referer = request.headers.get("referer")
    try {
      const ref = referer ? new URL(referer) : null
      target = ref && ref.host === request.nextUrl.host ? ref.pathname + ref.search : "/"
    } catch {
      target = "/"
    }
  }

  const response = NextResponse.redirect(new URL(target, request.url))
  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  })

  return response
}
