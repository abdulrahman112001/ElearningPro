import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSchoolAccess, SCHOOL_STAFF_ROLES } from "@/lib/school"
import { requireUser, run } from "../../_shared"

type Params = { params: { orgId: string } }

// GET /api/school/:orgId/classes : the school's classes with subjects, and its teachers
export async function GET(_request: Request, { params }: Params) {
  return run("School classes", async () => {
    const session = await requireUser()
    const { org, canManage } = await requireSchoolAccess(params.orgId, session.user, false)
    const [classes, staff, terms] = await Promise.all([
      db.classGroup.findMany({
        where: { organizationId: params.orgId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          instructor: { select: { id: true, name: true } },
          _count: { select: { members: true } },
          subjects: {
            orderBy: { subject: "asc" },
            select: { id: true, subject: true, teacher: { select: { id: true, name: true, image: true } } },
          },
        },
      }),
      db.organizationMember.findMany({
        where: { organizationId: params.orgId, role: { in: SCHOOL_STAFF_ROLES } },
        select: { role: true, title: true, user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { joinedAt: "asc" },
      }),
      db.academicTerm.findMany({
        where: { organizationId: params.orgId },
        orderBy: { startsAt: "desc" },
        select: { id: true, name: true, startsAt: true, endsAt: true, isCurrent: true },
      }),
    ])
    return NextResponse.json({
      organization: org,
      canManage,
      classes,
      teachers: staff.map((s) => ({ ...s.user, role: s.role, title: s.title })),
      terms,
    })
  })
}
