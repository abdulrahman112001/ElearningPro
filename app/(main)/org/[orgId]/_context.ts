import { cache } from "react"
import { notFound, redirect } from "next/navigation"
import type { OrganizationRole } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getOrgMembership, ORG_MANAGER_ROLES } from "@/lib/organization"

/**
 * Loads the organization and the viewer's role for /org/[orgId] pages.
 * Non-members get a 404 (the API answers 403); admins act as OWNER.
 */
export const getOrgContext = cache(async (orgId: string) => {
  const session = await auth()
  if (!session?.user) redirect(`/login?callbackUrl=/org/${orgId}`)
  const org = await db.organization.findUnique({ where: { id: orgId } })
  if (!org) notFound()
  const isAdmin = session.user.role === "ADMIN"
  let role: OrganizationRole = "OWNER"
  if (!isAdmin) {
    const m = await getOrgMembership(orgId, session.user.id)
    if (!m) notFound()
    role = m.role
  }
  return {
    session,
    org,
    role,
    isAdmin,
    isManager: ORG_MANAGER_ROLES.includes(role),
  }
})

/** Same as getOrgContext, but 404s unless the viewer has one of `roles`. */
export async function requireOrgPage(orgId: string, roles: OrganizationRole[]) {
  const ctx = await getOrgContext(orgId)
  if (!roles.includes(ctx.role)) notFound()
  return ctx
}
