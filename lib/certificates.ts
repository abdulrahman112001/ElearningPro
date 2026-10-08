import crypto from "crypto"
import { db } from "@/lib/db"

/**
 * Single generator for certificate numbers: CERT-<base36 time>-<8 random hex>.
 * crypto randomness makes numbers unguessable for the public verify page.
 */
export function generateCertificateNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `CERT-${timestamp}-${random}`
}

/**
 * Every quiz on a published lesson of the course must have a passed attempt
 * by the user before a certificate is issued.
 */
export async function hasPassedAllQuizzes(userId: string, courseId: string): Promise<boolean> {
  const quizzes = await db.quiz.findMany({
    where: {
      lesson: { isPublished: true, chapter: { courseId } },
    },
    select: { id: true },
  })
  if (quizzes.length === 0) return true
  const passed = await db.quizAttempt.findMany({
    where: { userId, passed: true, quizId: { in: quizzes.map((q) => q.id) } },
    select: { quizId: true },
    distinct: ["quizId"],
  })
  return passed.length === quizzes.length
}

/** Certificate grade: average of the best score on each quiz, 100 if none. */
export async function computeCertificateGrade(userId: string, courseId: string): Promise<number> {
  const attempts = await db.quizAttempt.findMany({
    where: { userId, completedAt: { not: null }, quiz: { lesson: { chapter: { courseId } } } },
    select: { quizId: true, score: true },
  })
  const best: Record<string, number> = {}
  for (const a of attempts) best[a.quizId] = Math.max(best[a.quizId] ?? 0, a.score)
  const scores = Object.values(best)
  return scores.length > 0 ? scores.reduce((x, y) => x + y, 0) / scores.length : 100
}
