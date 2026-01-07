import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

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

    // Calculate grade (average of quiz scores or just completion)
    const quizAttempts = await db.quizAttempt.findMany({
      where: {
        userId: session.user.id,
        quiz: {
          lesson: {
            chapter: {
              courseId,
            },
          },
        },
      },
      orderBy: { score: "desc" },
    })

    // Get best score per quiz
    const quizScores: Record<string, number> = {}
    for (const attempt of quizAttempts) {
      if (
        !quizScores[attempt.quizId] ||
        attempt.score > quizScores[attempt.quizId]
      ) {
        quizScores[attempt.quizId] = attempt.score
      }
    }

    const scores = Object.values(quizScores)
    const grade =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 100 // Default to 100 if no quizzes

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
    console.error("Get certificate error:", error)
    return NextResponse.json(
      { error: "Failed to get certificate" },
      { status: 500 }
    )
  }
}

function generateCertificateNumber(): string {
  const prefix = "CERT"
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}
