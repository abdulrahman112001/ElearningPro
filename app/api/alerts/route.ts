import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { isStudentOfInstructor } from "@/lib/access"
import { logActivity } from "@/lib/activity"
import { pendingInstructorResponse } from "@/lib/instructor-guard"
import { sendEmail } from "@/lib/email"

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

function guardianEmailHtml(opts: { guardianName?: string | null; studentName: string; senderName: string; title: string; message: string }) {
  return `
  <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
    <h2 style="color:#4f46e5;margin-bottom:4px">${escapeHtml(opts.title)}</h2>
    <p>${opts.guardianName ? `السيد/ة ${escapeHtml(opts.guardianName)}،` : "ولي الأمر الكريم،"}</p>
    <p>رسالة بخصوص الطالب/ة <strong>${escapeHtml(opts.studentName)}</strong> من ${escapeHtml(opts.senderName)}:</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:16px;white-space:pre-line">${escapeHtml(opts.message)}</div>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">هذه رسالة من منصة E-Learn التعليمية.</p>
  </div>`
}

// GET /api/alerts?studentId= : alerts sent by the current teacher (admins: all)
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const isAdmin = session.user.role === "ADMIN"
    if (!isAdmin && session.user.role !== "INSTRUCTOR") {
      // Students read their alerts through notifications.
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const studentId = new URL(request.url).searchParams.get("studentId")
    const alerts = await db.studentAlert.findMany({
      where: { ...(isAdmin ? {} : { senderId: session.user.id }), ...(studentId && { studentId }) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        student: { select: { id: true, name: true, email: true } },
        sender: { select: { id: true, name: true, role: true } },
      },
    })
    return NextResponse.json(alerts)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get alerts error:", error)
    return NextResponse.json({ error: "Failed to get alerts" }, { status: 500 })
  }
}

// POST /api/alerts { studentId, title, message, toGuardian? }
// A teacher (for their own students) or an admin alerts a student; optionally
// the guardian receives the same message by email.
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const isAdmin = session.user.role === "ADMIN"
    if (!isAdmin && session.user.role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const pending = pendingInstructorResponse(session)
    if (pending) return pending

    const { studentId, title, message, toGuardian = false } = await readJson(request)
    if (typeof studentId !== "string" || !studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 })
    }
    if (typeof title !== "string" || !title.trim() || title.length > 150) {
      return NextResponse.json({ error: "Title is required (max 150 characters)" }, { status: 400 })
    }
    if (typeof message !== "string" || !message.trim() || message.length > 3000) {
      return NextResponse.json({ error: "Message is required (max 3000 characters)" }, { status: 400 })
    }
    if (typeof toGuardian !== "boolean") {
      return NextResponse.json({ error: "toGuardian must be boolean" }, { status: 400 })
    }

    const student = await db.user.findFirst({
      where: { id: studentId, role: "STUDENT" },
      select: { id: true, name: true, guardianName: true, guardianEmail: true },
    })
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })
    if (!isAdmin && !(await isStudentOfInstructor(student.id, session.user.id))) {
      return NextResponse.json({ error: "This student is not one of your students" }, { status: 403 })
    }
    if (toGuardian && !student.guardianEmail) {
      return NextResponse.json(
        { error: "This student has no guardian email on file", code: "no_guardian_email" },
        { status: 400 }
      )
    }

    let emailDelivered = false
    let emailError: string | undefined
    if (toGuardian && student.guardianEmail) {
      try {
        await sendEmail({
          to: student.guardianEmail,
          subject: title.trim(),
          html: guardianEmailHtml({
            guardianName: student.guardianName,
            studentName: student.name ?? "",
            senderName: session.user.name ?? (isAdmin ? "إدارة المنصة" : "المعلم"),
            title: title.trim(),
            message: message.trim(),
          }),
        })
        emailDelivered = true
      } catch (error) {
        emailError = error instanceof Error ? error.message : "Email failed"
        console.error("Guardian email failed:", error)
      }
    }

    const alert = await db.studentAlert.create({
      data: {
        senderId: session.user.id,
        studentId: student.id,
        title: title.trim(),
        message: message.trim(),
        toGuardian,
        guardianEmail: toGuardian ? student.guardianEmail : null,
        emailDelivered,
      },
    })
    await db.notification.create({
      data: {
        userId: student.id,
        type: "STUDENT_ALERT",
        title: title.trim(),
        message: message.trim().slice(0, 500),
        link: "/student",
      },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "alert.sent",
      entityType: "user",
      entityId: student.id,
      summary: `Alert to ${student.name ?? "student"}${toGuardian ? " (+ guardian email)" : ""}: ${title.trim()}`,
      metadata: { alertId: alert.id, emailDelivered },
    })

    return NextResponse.json({ ...alert, emailError }, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Send alert error:", error)
    return NextResponse.json({ error: "Failed to send alert" }, { status: 500 })
  }
}
