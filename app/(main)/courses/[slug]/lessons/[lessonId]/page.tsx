import { redirect } from "next/navigation"

// Lessons are played inside the course player at /courses/:slug/learn/:lessonId.
// This route exists so links to /courses/:slug/lessons/:lessonId (quiz result
// "back to lesson", older bookmarks) land there instead of on a 404.
export default function LessonRedirectPage({
  params,
}: {
  params: { slug: string; lessonId: string }
}) {
  redirect(`/courses/${params.slug}/learn/${params.lessonId}`)
}
