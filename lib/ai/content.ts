import { db } from "@/lib/db"
import { stripHtml } from "@/lib/ai/validate"

// Upper bound for course material sent in one request (~50k tokens). A course
// whose transcripts exceed it is cut at lesson boundaries and the prompt says so.
const MAX_MATERIAL_CHARS = 200_000

const both = (ar?: string | null, en?: string | null) =>
  [ar, en].filter((s, i, a) => s && s.trim() && a.indexOf(s) === i).join(" / ")

export async function loadCourseForAi(courseId: string) {
  return db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      instructorId: true,
      classGroupId: true,
      titleAr: true,
      titleEn: true,
      descriptionAr: true,
      descriptionEn: true,
      whatYouLearn: true,
      language: true,
      chapters: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          titleAr: true,
          titleEn: true,
          descriptionAr: true,
          descriptionEn: true,
          lessons: {
            orderBy: { position: "asc" },
            select: { id: true, titleAr: true, titleEn: true, descriptionAr: true, descriptionEn: true, transcript: true },
          },
        },
      },
    },
  })
}
export type AiCourse = NonNullable<Awaited<ReturnType<typeof loadCourseForAi>>>

/** Course outline: chapter and lesson titles only (cheap, used by the tutor). */
export function courseOutline(course: AiCourse): string {
  const lines = [`Course: ${both(course.titleAr, course.titleEn)}`]
  const description = stripHtml(course.descriptionAr || course.descriptionEn)
  if (description) lines.push(`Description: ${description.slice(0, 3000)}`)
  if (course.whatYouLearn.length) lines.push(`Learning outcomes: ${course.whatYouLearn.join("; ")}`)
  course.chapters.forEach((ch, i) => {
    lines.push(`${i + 1}. ${both(ch.titleAr, ch.titleEn)}`)
    ch.lessons.forEach((l, j) => lines.push(`   ${i + 1}.${j + 1} ${both(l.titleAr, l.titleEn)}`))
  })
  return lines.join("\n")
}

function lessonBlock(lesson: AiCourse["chapters"][number]["lessons"][number]): string {
  const parts = [`<lesson title="${both(lesson.titleAr, lesson.titleEn).replace(/"/g, "'")}">`]
  const desc = stripHtml(both(lesson.descriptionAr, lesson.descriptionEn))
  if (desc) parts.push(`<description>${desc}</description>`)
  if (lesson.transcript?.trim()) parts.push(`<transcript>${lesson.transcript.trim()}</transcript>`)
  parts.push("</lesson>")
  return parts.join("\n")
}

/** Material for question generation: one lesson, or the whole course. */
export function courseMaterial(course: AiCourse, lessonId?: string): { text: string; truncated: boolean } {
  const out: string[] = [`<course title="${both(course.titleAr, course.titleEn).replace(/"/g, "'")}">`]
  const description = stripHtml(both(course.descriptionAr, course.descriptionEn))
  if (description) out.push(`<course_description>${description}</course_description>`)
  let size = out.join("\n").length
  let truncated = false
  for (const ch of course.chapters) {
    const lessons = lessonId ? ch.lessons.filter((l) => l.id === lessonId) : ch.lessons
    if (!lessons.length) continue
    out.push(`<chapter title="${both(ch.titleAr, ch.titleEn).replace(/"/g, "'")}">`)
    const chDesc = stripHtml(both(ch.descriptionAr, ch.descriptionEn))
    if (chDesc) out.push(`<chapter_description>${chDesc}</chapter_description>`)
    for (const lesson of lessons) {
      const block = lessonBlock(lesson)
      if (size + block.length > MAX_MATERIAL_CHARS) {
        truncated = true
        break
      }
      out.push(block)
      size += block.length
    }
    out.push("</chapter>")
    if (truncated) break
  }
  out.push("</course>")
  return { text: out.join("\n"), truncated }
}

/** The current lesson's own text for the tutor (description + transcript). */
export function lessonContext(course: AiCourse, lessonId?: string | null): string {
  if (!lessonId) return ""
  for (const ch of course.chapters) {
    const lesson = ch.lessons.find((l) => l.id === lessonId)
    if (lesson) {
      const block = lessonBlock(lesson)
      return `Chapter: ${both(ch.titleAr, ch.titleEn)}\n${block.slice(0, MAX_MATERIAL_CHARS / 2)}`
    }
  }
  return ""
}

export function findLessonCourseId(course: AiCourse, lessonId: string): boolean {
  return course.chapters.some((ch) => ch.lessons.some((l) => l.id === lessonId))
}
