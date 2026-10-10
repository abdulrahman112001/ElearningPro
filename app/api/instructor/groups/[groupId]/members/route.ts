import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"

// POST /api/instructor/groups/:id/members { email } or { studentId }
export async function POST(request: Request, { params }: { params: { groupId: string } }) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const group = await db.classGroup.findFirst({
      where: {
        id: params.groupId,
        ...(session.user.role === "ADMIN" ? {} : { instructorId: session.user.id }),
      },
    })
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })

    const { email, studentId } = await readJson(request)
    if (typeof email !== "string" && typeof studentId !== "string") {
      return NextResponse.json({ error: "email or studentId is required" }, { status: 400 })
    }
    const student = await db.user.findFirst({
      where: {
        role: "STUDENT",
        ...(typeof studentId === "string"
          ? { id: studentId }
          : { email: { equals: email.trim(), mode: "insensitive" as const } }),
      },
      select: { id: true, name: true },
    })
    if (!student) return NextResponse.json({ error: "No student account with this email" }, { status: 404 })

    // Respect the group capacity (re-adding an existing member is fine).
    if (group.capacity) {
      const [count, already] = await Promise.all([
        db.classGroupMember.count({ where: { groupId: group.id } }),
        db.classGroupMember.findUnique({
          where: { groupId_studentId: { groupId: group.id, studentId: student.id } },
        }),
      ])
      if (!already && count >= group.capacity) {
        return NextResponse.json({ error: "Group is full", code: "group_full" }, { status: 409 })
      }
    }

    const member = await db.classGroupMember.upsert({
      where: { groupId_studentId: { groupId: group.id, studentId: student.id } },
      update: {},
      create: { groupId: group.id, studentId: student.id },
    })

    await db.notification.create({
      data: {
        userId: student.id,
        type: "SYSTEM",
        title: "Added to a class group",
        message: `You were added to "${group.name}".`,
        link: "/student/courses",
      },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "group.member_added",
      entityType: "classGroup",
      entityId: group.id,
      summary: `Added ${student.name ?? "a student"} to "${group.name}"`,
      metadata: { studentId: student.id },
    })
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Add group member error:", error)
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
  }
}
