import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ApiError } from "@/lib/api-error"
import { canManageGroup } from "@/lib/organization"
import { buildReportCards, requireOrgGroup, requireSchoolAccess } from "@/lib/school"
import { requireUser, run } from "../../_shared"

type Params = { params: { orgId: string } }

/**
 * GET /api/school/:orgId/report-cards?groupId=&termId=
 * School managers, or the class's homeroom teacher. termId defaults to the
 * current term.
 */
export async function GET(request: Request, { params }: Params) {
  return run("Report cards", async () => {
    const session = await requireUser()
    const { org } = await requireSchoolAccess(params.orgId, session.user, false)
    const url = new URL(request.url)
    const group = await requireOrgGroup(params.orgId, url.searchParams.get("groupId"))
    if (!(await canManageGroup(group.id, session.user))) {
      throw new ApiError(403, "Only school managers or the class teacher can see report cards")
    }
    const termId = url.searchParams.get("termId")
    const term = await db.academicTerm.findFirst({
      where: { organizationId: params.orgId, ...(termId ? { id: termId } : { isCurrent: true }) },
      select: { id: true, name: true, startsAt: true, endsAt: true, isCurrent: true },
    })
    if (!term) throw new ApiError(termId ? 404 : 400, termId ? "Term not found" : "No current term", { code: "no_term" })
    const cards = await buildReportCards(group.id, term)
    const homeroom = await db.user.findUnique({ where: { id: group.instructorId }, select: { id: true, name: true } })
    return NextResponse.json({ organization: org, group: { id: group.id, name: group.name, homeroom }, term, cards })
  })
}
