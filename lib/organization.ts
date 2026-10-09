import type { OrganizationRole } from "@prisma/client"
import { db } from "@/lib/db"

/** Roles that can manage an organization (members, classes, settings). */
export const ORG_MANAGER_ROLES: OrganizationRole[] = ["OWNER", "MANAGER"]

/** The user's membership in an organization, or null. */
export async function getOrgMembership(organizationId: string, userId: string) {
  return db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { id: true, role: true, title: true },
  })
}

/**
 * True when the user has one of `roles` in the organization. Platform admins
 * always pass.
 */
export async function hasOrgRole(
  organizationId: string,
  user: { id: string; role?: string },
  roles: OrganizationRole[]
): Promise<boolean> {
  if (user.role === "ADMIN") return true
  const m = await getOrgMembership(organizationId, user.id)
  return !!m && roles.includes(m.role)
}

/**
 * Whether the user may manage a class group: its teacher, a manager of the
 * group's organization, or a platform admin.
 */
export async function canManageGroup(
  groupId: string,
  user: { id: string; role?: string }
): Promise<boolean> {
  if (user.role === "ADMIN") return true
  const group = await db.classGroup.findUnique({
    where: { id: groupId },
    select: { instructorId: true, organizationId: true },
  })
  if (!group) return false
  if (group.instructorId === user.id) return true
  return group.organizationId
    ? hasOrgRole(group.organizationId, user, ORG_MANAGER_ROLES)
    : false
}
