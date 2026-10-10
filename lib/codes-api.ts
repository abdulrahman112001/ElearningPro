import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse, readJson } from "@/lib/api-error"
import { requireAdmin, requireInstructor } from "@/lib/instructor-guard"
import {
  batchCsv,
  createCodeBatch,
  disableBatch,
  getBatchDetail,
  listBatches,
  setCodeDisabled,
  type CodeActor,
} from "@/lib/codes"

/**
 * Route handlers shared by /api/instructor/codes/** and /api/admin/codes/**.
 * The guard decides who may call; lib/codes scopes what they may touch.
 */
type Scope = "instructor" | "admin"

async function guard(scope: Scope): Promise<{ actor: CodeActor; error?: undefined } | { error: NextResponse }> {
  const g = scope === "admin" ? await requireAdmin() : await requireInstructor()
  if (g.error) return { error: g.error }
  return { actor: { id: g.session.user.id, role: g.session.user.role } }
}

function fail(error: unknown, what: string) {
  const handled = apiErrorResponse(error)
  if (handled) return handled
  console.error(`${what} error:`, error)
  return NextResponse.json({ error: `Failed to ${what}` }, { status: 500 })
}

export function listHandler(scope: Scope) {
  return async (request: Request) => {
    try {
      const g = await guard(scope)
      if (g.error) return g.error
      const url = new URL(request.url)
      const batches = await listBatches(g.actor, { type: url.searchParams.get("type"), q: url.searchParams.get("q") })
      return NextResponse.json({ batches })
    } catch (error) {
      return fail(error, "list code batches")
    }
  }
}

export function createHandler(scope: Scope) {
  return async (request: Request) => {
    try {
      const g = await guard(scope)
      if (g.error) return g.error
      const body = await readJson(request)
      const batch = await createCodeBatch(g.actor, body ?? {})
      return NextResponse.json(batch, { status: 201 })
    } catch (error) {
      return fail(error, "create code batch")
    }
  }
}

export function optionsHandler(scope: Scope) {
  return async () => {
    try {
      const g = await guard(scope)
      if (g.error) return g.error
      const isAdmin = scope === "admin"
      const [courses, instructors, profile] = await Promise.all([
        db.course.findMany({
          where: isAdmin ? { status: { not: "ARCHIVED" } } : { instructorId: g.actor.id },
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
            price: true,
            status: true,
            instructor: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        isAdmin
          ? db.user.findMany({
              where: { role: "INSTRUCTOR", instructorProfile: { isApproved: true } },
              select: { id: true, name: true, email: true },
              orderBy: { name: "asc" },
              take: 500,
            })
          : Promise.resolve([]),
        isAdmin
          ? Promise.resolve(null)
          : db.instructorProfile.findUnique({
              where: { userId: g.actor.id },
              select: { subscriptionEnabled: true, monthlyPrice: true },
            }),
      ])
      return NextResponse.json({
        courses,
        instructors,
        subscription: profile ?? null,
        canCreateWallet: isAdmin,
      })
    } catch (error) {
      return fail(error, "load code options")
    }
  }
}

type BatchParams = { params: { batchId: string } }

export function detailHandler(scope: Scope) {
  return async (_request: Request, { params }: BatchParams) => {
    try {
      const g = await guard(scope)
      if (g.error) return g.error
      return NextResponse.json(await getBatchDetail(g.actor, params.batchId))
    } catch (error) {
      return fail(error, "load code batch")
    }
  }
}

/** PATCH { action: "disable" } disables every unused code of the batch. */
export function batchPatchHandler(scope: Scope) {
  return async (request: Request, { params }: BatchParams) => {
    try {
      const g = await guard(scope)
      if (g.error) return g.error
      const body = await readJson(request)
      if (body?.action !== "disable") return NextResponse.json({ error: "Unknown action" }, { status: 400 })
      return NextResponse.json(await disableBatch(g.actor, params.batchId))
    } catch (error) {
      return fail(error, "update code batch")
    }
  }
}

export function exportHandler(scope: Scope) {
  return async (_request: Request, { params }: BatchParams) => {
    try {
      const g = await guard(scope)
      if (g.error) return g.error
      const { body, filename } = await batchCsv(g.actor, params.batchId)
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      })
    } catch (error) {
      return fail(error, "export codes")
    }
  }
}

/** PATCH { disabled: boolean } on one unused code. */
export function codePatchHandler(scope: Scope) {
  return async (request: Request, { params }: { params: { batchId: string; codeId: string } }) => {
    try {
      const g = await guard(scope)
      if (g.error) return g.error
      const body = await readJson(request)
      if (typeof body?.disabled !== "boolean") return NextResponse.json({ error: "disabled must be a boolean" }, { status: 400 })
      const code = await setCodeDisabled(g.actor, params.batchId, params.codeId, body.disabled)
      return NextResponse.json(code)
    } catch (error) {
      return fail(error, "update code")
    }
  }
}
