import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { VideoPlayer } from "@/components/learn/course-video-player"
import { CourseSidebar } from "@/components/learn/course-sidebar"
import { CourseContent } from "@/components/learn/course-content"
import { CourseNavigation } from "@/components/learn/course-navigation"

interface LearnPageProps {
  params: {
    slug: string
    lessonId?: string[]
  }
}

export async function generateMetadata({ params }: LearnPageProps) {
  const t = await getTranslations("learn")
  return {
    title: t("learning"),
  }
}

export default async function LearnPage({ params }: LearnPageProps) {
  const session = await auth()
  const t = await getTranslations("learn")

  if (!session?.user) {
    redirect(`/login?callbackUrl=/courses/${params.slug}/learn`)
  }

  // Get course with chapters and lessons
  const course = await db.course.findUnique({
    where: {
      slug: params.slug,
      status: "PUBLISHED",
    },
    include: {
      chapters: {
        where: { isPublished: true },
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  })

  if (!course) {
    notFound()
  }

  // Check enrollment
  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: course.id,
      },
    },
  })

  if (!enrollment) {
    redirect(`/courses/${params.slug}`)
  }

  // Get current lesson
  const lessonId = params.lessonId?.[0]
  let currentLesson

  if (lessonId) {
    currentLesson = await db.lesson.findFirst({
      where: {
        id: lessonId,
        isPublished: true,
        chapter: {
          courseId: course.id,
          isPublished: true,
        },
      },
      include: {
        chapter: true,
        resources: true,
      },
    })

    if (!currentLesson) {
      notFound()
    }
  } else {
    // Redirect to first lesson
    const firstLesson = course.chapters[0]?.lessons[0]
    if (firstLesson) {
      redirect(`/courses/${params.slug}/learn/${firstLesson.id}`)
    } else {
      // No lessons available
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">{t("noLessons")}</h1>
            <p className="text-muted-foreground">{t("noLessonsDesc")}</p>
          </div>
        </div>
      )
    }
  }

  // Get progress for this lesson
  const progress = await db.progress.findUnique({
    where: {
      userId_lessonId: {
        userId: session.user.id,
        lessonId: currentLesson.id,
      },
    },
  })

  // Get all lessons for navigation
  const allLessons = course.chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({
      ...lesson,
      chapterId: chapter.id,
      chapterTitle: chapter.titleEn,
      chapterTitleAr: chapter.titleAr,
    }))
  )

  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id)
  const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
  const nextLesson =
    currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <CourseSidebar
        course={course}
        chapters={course.chapters}
        currentLessonId={currentLesson.id}
        userId={session.user.id}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Video Player */}
        <VideoPlayer
          lesson={currentLesson}
          progress={progress}
          userId={session.user.id}
          courseSlug={params.slug}
          nextLesson={nextLesson}
        />

        {/* Lesson Content & Navigation */}
        <div className="flex-1 overflow-y-auto">
          <div className="container max-w-4xl mx-auto p-6 space-y-6">
            <CourseContent lesson={currentLesson} />

            <CourseNavigation
              courseSlug={params.slug}
              previousLesson={previousLesson}
              nextLesson={nextLesson}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
