import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"

export const FIXTURE_FILE = path.join(__dirname, ".fixtures.json")
const TAG = "QA-FIXTURE"

/**
 * Creates the data the QA specs need on top of `prisma/seed.ts`:
 * coupons in every state, quizzes owned by each instructor, a stale quiz
 * attempt and withdrawals. Previous QA data is wiped first so runs repeat.
 */
export default async function globalSetup() {
  const db = new PrismaClient()
  try {
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@elearning.com" } })
    const ahmed = await db.user.findUniqueOrThrow({ where: { email: "ahmed@elearning.com" } })
    const sara = await db.user.findUniqueOrThrow({ where: { email: "sara@elearning.com" } })
    const student = await db.user.findUniqueOrThrow({ where: { email: "student@elearning.com" } })

    // ---- cleanup of previous runs -------------------------------------
    await db.coupon.deleteMany({ where: { code: { startsWith: "QA-", mode: "insensitive" } } })
    await db.liveClass.deleteMany({ where: { title: { startsWith: "QA " } } })
    await db.course.deleteMany({ where: { instructor: { email: { endsWith: "@qa.test" } } } })
    await db.withdrawal.deleteMany({ where: { note: { contains: TAG } } })
    await db.user.deleteMany({ where: { email: { endsWith: "@qa.test" } } })
    await db.user.update({ where: { id: student.id }, data: { isBlocked: false } })

    // ---- courses / lessons --------------------------------------------
    const lessonsOf = async (slug: string) => {
      const course = await db.course.findUniqueOrThrow({
        where: { slug },
        include: { chapters: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } } },
      })
      return { course, lessons: course.chapters.flatMap((c) => c.lessons), chapters: course.chapters }
    }
    const react = await lessonsOf("react-zero-to-hero") // ahmed, student enrolled
    const uiux = await lessonsOf("ui-ux-design") // sara, student NOT enrolled
    const free = await db.course.findUniqueOrThrow({ where: { slug: "html-css-basics" } })
    const nextjs = await db.course.update({
      where: { slug: "nextjs-fullstack" },
      data: { requirements: ["QA requirement"], whatYouLearn: ["QA outcome"] },
    })
    if (react.lessons.length < 2 || uiux.lessons.length < 1) {
      throw new Error("Seed data changed: expected >=2 react lessons and >=1 ui-ux lesson")
    }
    // By lesson, not title: OWN-07 proves a foreign instructor can rename the quiz.
    await db.quiz.deleteMany({ where: { lessonId: { in: [react.lessons[0].id, react.lessons[1].id, uiux.lessons[0].id] } } })

    // ---- quizzes ------------------------------------------------------
    const mkQuiz = (lessonId: string, title: string, timeLimit: number | null) =>
      db.quiz.create({
        data: {
          lessonId,
          title: `${TAG} ${title}`,
          passingScore: 50,
          timeLimit,
          questions: {
            create: [
              {
                question: "2 + 2 = ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                position: 0,
                options: [
                  { id: "a", text: "4", textAr: "4", isCorrect: true },
                  { id: "b", text: "5", textAr: "5", isCorrect: false },
                ],
              },
              {
                question: "Pick the vowels",
                type: "MULTIPLE_SELECT",
                points: 1,
                position: 1,
                options: [
                  { id: "x", text: "a", textAr: "a", isCorrect: true },
                  { id: "y", text: "e", textAr: "e", isCorrect: true },
                  { id: "z", text: "k", textAr: "k", isCorrect: false },
                ],
              },
            ],
          },
        },
        include: { questions: true },
      })

    const reactQuiz = await mkQuiz(react.lessons[0].id, "react main", null)
    const timedQuiz = await mkQuiz(react.lessons[1].id, "react timed", 5)
    const saraQuiz = await mkQuiz(uiux.lessons[0].id, "sara quiz", null)

    // Attempt started 3 hours ago on a 5-minute quiz.
    const staleAttempt = await db.quizAttempt.create({
      data: {
        quizId: timedQuiz.id,
        userId: student.id,
        score: 0,
        passed: false,
        startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    })

    // ---- coupons ------------------------------------------------------
    const base = { createdById: admin.id, isActive: true }
    await db.coupon.createMany({
      data: [
        { ...base, code: "QA-PCT50", discountType: "percentage", discountValue: 50, maxDiscount: 60 },
        { ...base, code: "QA-FIXED30", discountType: "fixed", discountValue: 30 },
        { ...base, code: "QA-HUGEFIXED", discountType: "fixed", discountValue: 100000 },
        { ...base, code: "QA-EXPIRED", discountType: "percentage", discountValue: 10, expiryDate: new Date(Date.now() - 86_400_000) },
        { ...base, code: "QA-MAXED", discountType: "percentage", discountValue: 10, maxUses: 1, usedCount: 1 },
        { ...base, code: "QA-MINBUY", discountType: "percentage", discountValue: 10, minPurchase: 100000 },
        { ...base, code: "QA-INACTIVE", discountType: "percentage", discountValue: 10, isActive: false },
        { ...base, code: "QA-OTHERCOURSE", discountType: "percentage", discountValue: 10, courseId: uiux.course.id },
        { ...base, code: "QA-FULL100", discountType: "percentage", discountValue: 100 },
      ],
    })

    // ---- withdrawals --------------------------------------------------
    // prisma/seed.ts does not create InstructorProfile rows for its instructors.
    await db.instructorProfile.upsert({
      where: { userId: ahmed.id },
      update: { pendingEarnings: 1000, paidEarnings: 0 },
      create: { userId: ahmed.id, isApproved: true, applicationStatus: "APPROVED", pendingEarnings: 1000, paidEarnings: 0 },
    })
    const mkWithdrawal = () =>
      db.withdrawal.create({
        data: {
          userId: ahmed.id,
          amount: 100,
          method: "paypal",
          status: "PENDING",
          note: JSON.stringify({ tag: TAG, paypalEmail: "ahmed-payout@qa.test" }),
        },
      })
    const wRejectThenComplete = await mkWithdrawal()
    const wRace = await mkWithdrawal()

    const category = await db.category.findFirstOrThrow()
    const fixtures = {
      categoryId: category.id,
      users: { admin: admin.id, ahmed: ahmed.id, sara: sara.id, student: student.id },
      courses: {
        react: { id: react.course.id, slug: react.course.slug, chapterIds: react.chapters.map((c) => c.id), lessonIds: react.lessons.map((l) => l.id) },
        uiux: { id: uiux.course.id, slug: uiux.course.slug, chapterIds: uiux.chapters.map((c) => c.id), lessonIds: uiux.lessons.map((l) => l.id) },
        free: { id: free.id, slug: free.slug },
        nextjs: { id: nextjs.id, slug: nextjs.slug },
      },
      quizzes: {
        react: { id: reactQuiz.id, lessonId: reactQuiz.lessonId, questionIds: reactQuiz.questions.sort((a, b) => a.position - b.position).map((q) => q.id) },
        timed: { id: timedQuiz.id, lessonId: timedQuiz.lessonId, staleAttemptId: staleAttempt.id, questionIds: timedQuiz.questions.sort((a, b) => a.position - b.position).map((q) => q.id) },
        sara: { id: saraQuiz.id, lessonId: saraQuiz.lessonId },
      },
      withdrawals: { rejectThenComplete: wRejectThenComplete.id, race: wRace.id },
    }
    fs.writeFileSync(FIXTURE_FILE, JSON.stringify(fixtures, null, 2))
  } finally {
    await db.$disconnect()
  }
}
