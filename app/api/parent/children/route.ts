import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { ApiError, apiErrorResponse, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import {
  MAX_PARENTS_PER_STUDENT,
  PARENT_RELATIONS,
  normalizeLinkCode,
  requireParent,
} from "@/lib/reports/parent-links"
import { getChildCardIndicators } from "@/lib/reports/child-overview"

/** The signed-in parent's linked children with key indicators. */
export async function GET() {
  try {
    const guard = await requireParent()
    if (guard.error) return guard.error
    const links = await db.parentLink.findMany({
      where: { parentId: guard.session.user.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: {
        relation: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            image: true,
            gradeLevel: { select: { nameAr: true, nameEn: true } },
          },
        },
      },
    })
    const children = await Promise.all(
      links.map(async (l) => ({
        ...l.student,
        relation: l.relation,
        linkedAt: l.createdAt,
        indicators: await getChildCardIndicators(l.student.id),
      }))
    )
    return NextResponse.json({ children })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Parent children error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/** Links a child by the code shown on their /student/family page. */
export async function POST(request: Request) {
  try {
    const guard = await requireParent()
    if (guard.error) return guard.error
    const { session } = guard
    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Only parent accounts can link children" }, { status: 403 })
    }
    const parentId = session.user.id

    // Codes are 8 chars from a 31-char alphabet; throttling stops guessing.
    const limit = rateLimit({ identifier: parentId, scope: "parent-link", limit: 10, windowMs: 15 * 60_000 })
    if (!limit.success) return tooManyRequests(limit.resetAt)

    const body = await readJson(request)
    const code = normalizeLinkCode(body.code)
    if (!code) {
      return NextResponse.json({ error: "Invalid code", code: "invalid_code" }, { status: 400 })
    }
    const relation = body.relation == null || body.relation === "" ? null : body.relation
    if (relation !== null && !PARENT_RELATIONS.includes(relation)) {
      return NextResponse.json({ error: "Invalid relation", code: "invalid_relation" }, { status: 400 })
    }

    const student = await db.user.findUnique({
      where: { parentLinkCode: code },
      select: { id: true, name: true, role: true, isBlocked: true },
    })
    if (!student || student.role !== "STUDENT" || student.isBlocked) {
      return NextResponse.json({ error: "No student has this code", code: "invalid_code" }, { status: 404 })
    }

    let link
    try {
      link = await db.$transaction(
        async (tx) => {
          const existing = await tx.parentLink.findUnique({
            where: { parentId_studentId: { parentId, studentId: student.id } },
          })
          if (existing) throw new ApiError(409, "Already linked", { code: "already_linked" })
          const count = await tx.parentLink.count({ where: { studentId: student.id } })
          if (count >= MAX_PARENTS_PER_STUDENT) {
            throw new ApiError(409, "This student already has the maximum number of parents", {
              code: "parent_limit",
              max: MAX_PARENTS_PER_STUDENT,
            })
          }
          return tx.parentLink.create({
            data: { parentId, studentId: student.id, relation, status: "ACTIVE" },
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034")) {
        return NextResponse.json({ error: "Already linked", code: "already_linked" }, { status: 409 })
      }
      throw e
    }

    const parentName = session.user.name ?? "ولي الأمر"
    await db.notification.create({
      data: {
        userId: student.id,
        type: "SYSTEM",
        title: "تم ربط ولي أمر بحسابك",
        message: `أصبح ${parentName} قادراً على متابعة تقدمك الدراسي. يمكنك إدارة ذلك من صفحة العائلة.`,
        link: "/student/family",
      },
    })
    await logActivity({
      actorId: parentId,
      actorRole: session.user.role,
      action: "parent.linked",
      entityType: "user",
      entityId: student.id,
      summary: `${parentName} linked to student ${student.name ?? student.id}`,
      metadata: { parentId, studentId: student.id, relation },
    })

    return NextResponse.json(
      { link: { id: link.id, relation: link.relation }, student: { id: student.id, name: student.name } },
      { status: 201 }
    )
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Parent link error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
