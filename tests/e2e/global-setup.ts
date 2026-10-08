import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"
import { generateCertificateNumber } from "../../lib/certificates"

export const IDS_FILE = path.join(__dirname, ".ids.json")

/**
 * Resolves the record ids the smoke specs visit from the seeded database
 * (cuid ids change on every seed), creating the certificate and live class
 * the seed does not provide.
 */
export default async function globalSetup() {
  const db = new PrismaClient()
  try {
    const student = await db.user.findUniqueOrThrow({ where: { email: "student@elearning.com" } })
    const instructor = await db.user.findUniqueOrThrow({ where: { email: "ahmed@elearning.com" } })
    const course = await db.course.findUniqueOrThrow({ where: { slug: "react-zero-to-hero" } })
    const free = await db.course.findUniqueOrThrow({ where: { slug: "html-css-basics" } })
    const lesson = await db.lesson.findFirstOrThrow({
      where: { chapter: { courseId: course.id } },
      orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
    })
    const category = await db.category.findFirstOrThrow()

    const certificate = await db.certificate.upsert({
      where: { userId_courseId: { userId: student.id, courseId: free.id } },
      update: {},
      create: {
        certificateNo: generateCertificateNumber(),
        userId: student.id,
        courseId: free.id,
        completedAt: new Date(),
        grade: 100,
      },
    })

    const liveClass =
      (await db.liveClass.findFirst({ where: { instructorId: instructor.id, title: "E2E live class" } })) ??
      (await db.liveClass.create({
        data: {
          title: "E2E live class",
          roomName: `e2e-${Date.now()}`,
          instructorId: instructor.id,
          courseId: course.id,
          scheduledAt: new Date(Date.now() + 86_400_000),
        },
      }))

    const ids = {
      COURSE_ID: course.id,
      LESSON_ID: lesson.id,
      CATEGORY_ID: category.id,
      INSTRUCTOR_ID: instructor.id,
      CERTIFICATE_ID: certificate.id,
      CERTIFICATE_NO: certificate.certificateNo,
      LIVE_CLASS_ID: liveClass.id,
    }
    fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2))
  } finally {
    await db.$disconnect()
  }
}
