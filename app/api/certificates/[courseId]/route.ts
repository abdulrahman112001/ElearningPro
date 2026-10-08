import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-error"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  computeCertificateGrade,
  generateCertificateNumber,
  hasPassedAllQuizzes,
} from "@/lib/certificates"

// Generate certificate for completed course
export async function POST(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const courseId = params.courseId

    // Check enrollment and completion
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
      include: {
        course: {
          include: {
            instructor: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: "Not enrolled in this course" },
        { status: 403 }
      )
    }

    if (!enrollment.isCompleted) {
      return NextResponse.json(
        { error: "Course not completed" },
        { status: 400 }
      )
    }

    if (!(await hasPassedAllQuizzes(session.user.id, courseId))) {
      return NextResponse.json(
        { error: "All course quizzes must be passed", errorAr: "يجب اجتياز جميع اختبارات الدورة" },
        { status: 400 }
      )
    }

    // Check if certificate already exists
    const existingCertificate = await db.certificate.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
    })

    if (existingCertificate) {
      return NextResponse.json(existingCertificate)
    }

    // Generate unique certificate number
    const certificateNo = generateCertificateNumber()

    const grade = await computeCertificateGrade(session.user.id, courseId)

    // Create certificate
    const certificate = await db.certificate.create({
      data: {
        certificateNo,
        userId: session.user.id,
        courseId,
        completedAt: enrollment.completedAt || new Date(),
        grade,
      },
    })

    // Send notification
    const courseTitle = enrollment.course.titleEn || enrollment.course.titleAr
    await db.notification.create({
      data: {
        userId: session.user.id,
        type: "CERTIFICATE_ISSUED",
        title: "Certificate Earned!",
        message: `Congratulations! You've earned a certificate for completing "${courseTitle}"`,
        link: `/certificates/${certificate.id}`,
      },
    })

    return NextResponse.json(certificate, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Generate certificate error:", error)
    return NextResponse.json(
      { error: "Failed to generate certificate" },
      { status: 500 }
    )
  }
}

// Get certificate for a course
export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const certificate = await db.certificate.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: params.courseId,
        },
      },
      include: {
        course: {
          select: {
            titleEn: true,
            titleAr: true,
            instructor: {
              select: {
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!certificate) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(certificate)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get certificate error:", error)
    return NextResponse.json(
      { error: "Failed to get certificate" },
      { status: 500 }
    )
  }
}

