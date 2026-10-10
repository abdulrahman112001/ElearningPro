import { db } from "@/lib/db"

/**
 * Collects what the diagnosis needs about one student, limited to the given
 * courses (the teacher's courses, or every course for an admin).
 * `teacherId` limits attendance and homework to that teacher (null = admin).
 */
export async function gatherStudentData(opts: { studentId: string; courseIds: string[]; teacherId: string | null }) {
  const { studentId, courseIds, teacherId } = opts

  const [enrollments, answers, attempts, attendance, submissions, dueAssignments] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: studentId, courseId: { in: courseIds } },
      select: {
        progress: true,
        isCompleted: true,
        enrolledAt: true,
        course: { select: { titleAr: true, titleEn: true, totalLessons: true } },
      },
    }),
    db.quizAnswer.findMany({
      where: {
        attempt: { userId: studentId, completedAt: { not: null }, quiz: { lesson: { chapter: { courseId: { in: courseIds } } } } },
      },
      select: {
        isCorrect: true,
        manualScore: true,
        points: true,
        question: {
          select: {
            id: true,
            question: true,
            questionAr: true,
            type: true,
            points: true,
            quiz: { select: { lesson: { select: { titleAr: true, titleEn: true } } } },
          },
        },
      },
      take: 2000,
    }),
    db.quizAttempt.findMany({
      where: { userId: studentId, completedAt: { not: null }, quiz: { lesson: { chapter: { courseId: { in: courseIds } } } } },
      select: { score: true, passed: true, completedAt: true, quiz: { select: { title: true, titleAr: true } } },
      orderBy: { completedAt: "asc" },
      take: 200,
    }),
    db.attendanceRecord.findMany({
      where: { studentId, ...(teacherId && { session: { group: { instructorId: teacherId } } }) },
      select: { status: true },
    }),
    db.assignmentSubmission.findMany({
      where: {
        studentId,
        assignment: teacherId ? { teacherId } : { OR: [{ courseId: { in: courseIds } }, { courseId: null }] },
      },
      select: {
        score: true,
        isLate: true,
        gradedAt: true,
        assignment: { select: { id: true, title: true, maxScore: true } },
      },
      take: 200,
    }),
    db.assignment.findMany({
      where: {
        dueAt: { lt: new Date() },
        ...(teacherId && { teacherId }),
        OR: [
          { courseId: { in: courseIds } },
          { group: { members: { some: { studentId } } } },
        ],
      },
      select: { id: true, title: true },
      take: 200,
    }),
  ])

  // Wrong answers grouped by lesson, then by question.
  const byLesson = new Map<string, { lesson: string; answered: number; wrong: number; questions: Map<string, { text: string; wrong: number }> }>()
  for (const a of answers) {
    const lessonTitle = a.question.quiz.lesson.titleAr || a.question.quiz.lesson.titleEn
    const entry = byLesson.get(lessonTitle) ?? { lesson: lessonTitle, answered: 0, wrong: 0, questions: new Map() }
    entry.answered += 1
    const wrong =
      a.question.type === "ESSAY" ? a.manualScore != null && a.manualScore < a.question.points / 2 : !a.isCorrect
    if (wrong) {
      entry.wrong += 1
      const q = entry.questions.get(a.question.id) ?? { text: (a.question.questionAr || a.question.question).slice(0, 300), wrong: 0 }
      q.wrong += 1
      entry.questions.set(a.question.id, q)
    }
    byLesson.set(lessonTitle, entry)
  }

  const attendanceCounts = attendance.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  const submitted = new Set(submissions.map((s) => s.assignment.id))
  const missing = dueAssignments.filter((a) => !submitted.has(a.id))

  return {
    courses: enrollments.map((e) => ({
      course: e.course.titleAr || e.course.titleEn,
      progressPercent: Math.round(e.progress),
      completed: e.isCompleted,
      enrolledAt: e.enrolledAt.toISOString().slice(0, 10),
    })),
    quizAttempts: attempts.map((a) => ({
      quiz: a.quiz.titleAr || a.quiz.title,
      score: Math.round(a.score),
      passed: a.passed,
      date: a.completedAt?.toISOString().slice(0, 10),
    })),
    wrongAnswersByLesson: Array.from(byLesson.values())
      .filter((l) => l.wrong > 0)
      .sort((a, b) => b.wrong / b.answered - a.wrong / a.answered)
      .slice(0, 20)
      .map((l) => ({
        lesson: l.lesson,
        answered: l.answered,
        wrong: l.wrong,
        questions: Array.from(l.questions.values())
          .sort((a, b) => b.wrong - a.wrong)
          .slice(0, 5),
      })),
    attendance: attendance.length ? { total: attendance.length, ...attendanceCounts } : "no attendance records",
    homework: {
      submitted: submissions.map((s) => ({
        title: s.assignment.title,
        score: s.score,
        maxScore: s.assignment.maxScore,
        late: s.isLate,
        graded: !!s.gradedAt,
      })),
      missingPastDue: missing.map((a) => a.title),
    },
    totals: { answers: answers.length, attempts: attempts.length },
  }
}
export type StudentData = Awaited<ReturnType<typeof gatherStudentData>>
