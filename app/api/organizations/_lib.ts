import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import type { Organization, OrganizationRole, OrganizationType } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ApiError } from "@/lib/api-error"
import { getOrgMembership } from "@/lib/organization"

/**
 * Server helpers shared by the organization API routes and pages.
 * (Not a route: Next only routes `route.ts` files.)
 */

export const ORG_TYPES: OrganizationType[] = ["CENTER", "SCHOOL", "ACADEMY"]
export const ORG_ROLES: OrganizationRole[] = ["OWNER", "MANAGER", "TEACHER", "STUDENT"]
export const CLASS_MODES = ["ONLINE", "OFFLINE", "HYBRID"] as const
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Slugs that would clash with routes or common subdomains. */
const RESERVED_SLUGS = new Set([
  "www", "api", "app", "admin", "org", "o", "mail", "static", "assets", "cdn",
  "login", "register", "student", "instructor", "parent", "help", "support", "new",
])

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/

const AR_MAP: Record<string, string> = {
  ا: "a", أ: "a", إ: "e", آ: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh",
  د: "d", ذ: "z", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "k", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a",
  و: "w", ؤ: "o", ي: "y", ى: "a", ئ: "e", ء: "", "ـ": "",
}

/** URL-safe ASCII slug; Arabic letters are transliterated. */
export function slugify(input: string): string {
  const latin = Array.from(input.normalize("NFKD"))
    .map((ch) => (ch in AR_MAP ? AR_MAP[ch] : ch))
    .join("")
    .replace(/[̀-ًͯ-ٟ]/g, "")
    .toLowerCase()
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50)
    .replace(/-+$/g, "")
}

export function isValidSlug(slug: string) {
  return SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug)
}

export async function slugTaken(slug: string, excludeId?: string) {
  const found = await db.organization.findUnique({ where: { slug }, select: { id: true } })
  return !!found && found.id !== excludeId
}

/** First free slug derived from `base` (base, base-2, base-3 ...). */
export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let root = slugify(base)
  if (root.length < 3 || RESERVED_SLUGS.has(root)) root = `org-${root || Math.random().toString(36).slice(2, 7)}`
  root = root.slice(0, 44).replace(/-+$/g, "")
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`
    if (!(await slugTaken(candidate, excludeId))) return candidate
  }
  return `${root}-${Date.now().toString(36)}`
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function optText(body: Record<string, unknown>, key: string, max: number): string | null | undefined {
  const v = body[key]
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v !== "string") throw new ApiError(400, `${key} must be text`)
  const s = v.trim()
  if (s.length > max) throw new ApiError(400, `${key} is too long (max ${max})`)
  return s || null
}

function optUrl(body: Record<string, unknown>, key: string): string | null | undefined {
  const s = optText(body, key, 500)
  if (!s) return s
  if (s.startsWith("/") && !s.startsWith("//")) return s
  try {
    const u = new URL(s)
    if (u.protocol === "https:" || u.protocol === "http:") return s
  } catch {}
  throw new ApiError(400, `${key} must be an http(s) URL`)
}

export interface OrgInput {
  name?: string
  type?: OrganizationType
  slug?: string
  description?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  governorate?: string | null
  logoUrl?: string | null
  coverUrl?: string | null
  primaryColor?: string | null
}

/** Validates create/update fields. `partial` = update (all optional). */
export function parseOrgInput(body: Record<string, unknown>, partial: boolean): OrgInput {
  const out: OrgInput = {}
  if (body.name !== undefined || !partial) {
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 120) {
      throw new ApiError(400, "Name is required (2-120 characters)")
    }
    out.name = body.name.trim()
  }
  if (body.type !== undefined) {
    if (!ORG_TYPES.includes(body.type as OrganizationType)) throw new ApiError(400, "Invalid organization type")
    out.type = body.type as OrganizationType
  }
  if (body.slug !== undefined && body.slug !== null && body.slug !== "") {
    if (typeof body.slug !== "string") throw new ApiError(400, "Invalid slug")
    const slug = body.slug.trim().toLowerCase()
    if (!isValidSlug(slug)) {
      throw new ApiError(400, "Slug must be 3-50 lowercase letters, numbers or dashes", { code: "invalid_slug" })
    }
    out.slug = slug
  }
  const description = optText(body, "description", 5000)
  if (description !== undefined) out.description = description
  const phone = optText(body, "phone", 30)
  if (phone !== undefined) {
    if (phone && !/^\+?[0-9 ()-]{6,30}$/.test(phone)) throw new ApiError(400, "Invalid phone number")
    out.phone = phone
  }
  const email = optText(body, "email", 200)
  if (email !== undefined) {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Invalid email")
    out.email = email ? email.toLowerCase() : null
  }
  const address = optText(body, "address", 300)
  if (address !== undefined) out.address = address
  const governorate = optText(body, "governorate", 60)
  if (governorate !== undefined) out.governorate = governorate
  const logoUrl = optUrl(body, "logoUrl")
  if (logoUrl !== undefined) out.logoUrl = logoUrl
  const coverUrl = optUrl(body, "coverUrl")
  if (coverUrl !== undefined) out.coverUrl = coverUrl
  const color = optText(body, "primaryColor", 7)
  if (color !== undefined) {
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) throw new ApiError(400, "primaryColor must be a #RRGGBB hex color")
    out.primaryColor = color ? color.toLowerCase() : null
  }
  return out
}

// ---------------------------------------------------------------------------
// Access guard
// ---------------------------------------------------------------------------

export type OrgGuard =
  | {
      session: Session
      org: Organization
      /** Effective role; platform admins act as OWNER. */
      role: OrganizationRole
      isAdmin: boolean
      error?: undefined
    }
  | { session?: undefined; org?: undefined; role?: undefined; isAdmin?: undefined; error: NextResponse }

/**
 * Signed-in member of the organization with one of `roles` (admins always
 * pass). Non-members get 403, a missing org 404. With `write`, a suspended
 * organization is read-only for everyone but admins.
 */
export async function requireOrg(
  orgId: string,
  roles: OrganizationRole[] = ORG_ROLES,
  opts: { write?: boolean } = {}
): Promise<OrgGuard> {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const org = await db.organization.findUnique({ where: { id: orgId } })
  if (!org) return { error: NextResponse.json({ error: "Organization not found" }, { status: 404 }) }
  const isAdmin = session.user.role === "ADMIN"
  let role: OrganizationRole = "OWNER"
  if (!isAdmin) {
    const m = await getOrgMembership(orgId, session.user.id)
    if (!m || !roles.includes(m.role)) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    role = m.role
  }
  if (opts.write && !org.isActive && !isAdmin) {
    return {
      error: NextResponse.json(
        { error: "This organization is suspended", code: "organization_suspended" },
        { status: 403 }
      ),
    }
  }
  return { session, org, role, isAdmin }
}

/** Absolute base URL for links in emails. */
export function appUrl(request?: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  if (env) return env.replace(/\/$/, "")
  if (request) return new URL(request.url).origin
  return ""
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

/** User ids of the organization's owner and managers. */
export async function orgManagerIds(orgId: string): Promise<string[]> {
  const rows = await db.organizationMember.findMany({
    where: { organizationId: orgId, role: { in: ["OWNER", "MANAGER"] } },
    select: { userId: true },
  })
  return rows.map((r) => r.userId)
}

/** Account roles allowed to hold each organization role. */
export function accountFitsOrgRole(accountRole: string, orgRole: OrganizationRole): boolean {
  switch (orgRole) {
    case "STUDENT":
      return accountRole === "STUDENT"
    case "TEACHER":
      return accountRole === "INSTRUCTOR"
    case "MANAGER":
      return accountRole === "INSTRUCTOR" || accountRole === "ADMIN"
    case "OWNER":
      return false
  }
}

export function serverError(label: string, error: unknown, message: string) {
  console.error(label, error)
  return NextResponse.json({ error: message }, { status: 500 })
}
