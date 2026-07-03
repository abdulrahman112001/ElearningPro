import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit"

// Verify certificate (public endpoint)
export async function GET(
  request: Request,
  { params }: { params: { certificateNo: string } }
) {
  try {
    // Throttle to prevent enumeration/brute-force of certificate numbers
    const { success, resetAt } = rateLimit({
      identifier: getClientIp(request),
      scope: "certificate-verify",
      limit: 10,
      windowMs: 60_000,
    })
    if (!success) {
      return tooManyRequests(resetAt)
    }

    const certificate = await db.certificate.findUnique({
      where: { certificateNo: params.certificateNo },
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
        { valid: false, error: "Certificate not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      valid: true,
      certificate: {
        certificateNo: certificate.certificateNo,
        holderName: certificate.user.name,
        courseTitle: certificate.course.titleEn,
        courseTitleAr: certificate.course.titleAr,
        instructorName: certificate.course.instructor.name,
        issuedAt: certificate.issuedAt,
        completedAt: certificate.completedAt,
        grade: certificate.grade,
      },
    })
  } catch (error) {
    console.error("Verify certificate error:", error)
    return NextResponse.json(
      { valid: false, error: "Verification failed" },
      { status: 500 }
    )
  }
}
