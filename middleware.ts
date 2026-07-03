import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Centralized route protection (defense-in-depth on top of the
// server-side layout guards). Runs on the Edge runtime.
export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  })

  const { pathname } = req.nextUrl
  const role = token?.role as string | undefined

  if (!token) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (
    pathname.startsWith("/instructor") &&
    role !== "INSTRUCTOR" &&
    role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/instructor/:path*", "/student/:path*"],
}
