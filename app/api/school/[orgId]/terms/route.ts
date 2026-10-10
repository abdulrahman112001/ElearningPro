import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ApiError, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireSchoolAccess } from "@/lib/school"
import { parseTermBody, requireUser, run } from "../../_shared"

type Params = { params: { orgId: string } }

// GET /api/school/:orgId/terms
export async function GET(_request: Request, { params }: Params) {
  return run("List terms", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, false)
    const terms = await db.academicTerm.findMany({
      where: { organizationId: params.orgId },
      orderBy: { startsAt: "desc" },
      include: { _count: { select: { gradeEntries: true } } },
    })
    return NextResponse.json(terms)
  })
}

// POST /api/school/:orgId/terms { name, startsAt, endsAt, isCurrent? }
export async function POST(request: Request, { params }: Params) {
  return run("Create term", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, true)
    const data = parseTermBody(await readJson(request), false)
    if (data.endsAt! <= data.startsAt!) {
      throw new ApiError(400, "The term must end after it starts", { field: "endsAt", code: "end_before_start" })
    }
    const term = await db.$transaction(async (tx) => {
      // The first term of a school becomes current automatically.
      const count = await tx.academicTerm.count({ where: { organizationId: params.orgId } })
      const isCurrent = data.isCurrent ?? count === 0
      if (isCurrent) {
        await tx.academicTerm.updateMany({ where: { organizationId: params.orgId }, data: { isCurrent: false } })
      }
      return tx.academicTerm.create({
        data: { organizationId: params.orgId, name: data.name!, startsAt: data.startsAt!, endsAt: data.endsAt!, isCurrent },
      })
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "term.created",
      entityType: "academicTerm",
      entityId: term.id,
      summary: `Created term "${term.name}"`,
      metadata: { organizationId: params.orgId },
    })
    return NextResponse.json(term, { status: 201 })
  })
}
