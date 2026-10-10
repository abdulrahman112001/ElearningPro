import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { apiErrorResponse } from "@/lib/api-error"
import { isValidSlug, serverError, slugTaken, slugify, uniqueSlug } from "../_lib"

/**
 * GET /api/organizations/slug?name=...           -> suggested free slug
 * GET /api/organizations/slug?slug=...&exclude=id -> availability of a slug
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const url = new URL(request.url)
    const exclude = url.searchParams.get("exclude") || undefined
    const slugParam = url.searchParams.get("slug")
    if (slugParam !== null) {
      const slug = slugParam.trim().toLowerCase()
      const valid = isValidSlug(slug)
      const available = valid && !(await slugTaken(slug, exclude))
      return NextResponse.json({
        slug,
        valid,
        available,
        suggestion: available ? slug : await uniqueSlug(slugify(slug) || "org", exclude),
      })
    }
    const name = (url.searchParams.get("name") || "").slice(0, 120)
    if (!name.trim()) return NextResponse.json({ error: "name or slug is required" }, { status: 400 })
    const slug = await uniqueSlug(name, exclude)
    return NextResponse.json({ slug, valid: true, available: true, suggestion: slug })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Slug check error:", error, "Failed to check slug")
  }
}
