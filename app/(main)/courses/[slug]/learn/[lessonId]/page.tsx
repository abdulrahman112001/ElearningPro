import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { VideoPlayer } from "@/components/learn/video-player"
import { LessonSidebar } from "@/components/learn/lesson-sidebar"
import { LessonNavigation } from "@/components/learn/lesson-navigation"
import { LessonContent } from "@/components/learn/lesson-content"

interface LearnPageProps {
  params: {
    slug: string
    lessonId: string
  }
}

export async function generateMetadata({ params }: LearnPageProps) {
  const t = await getTranslations("learn")

  const lesson = await db.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      chapter: {
        include: {
          course: true,
        },
      },
    },
  })

  return {
    title: lesson
      ? `${lesson.titleEn} | ${lesson.chapter.course.titleEn}`
      : t("lesson"),
  }
}

export default async function LearnPage({ params }: LearnPageProps) {
  const session = await auth()
  const t = await getTranslations("learn")

  if (!session?.user) {
    redirect(
      `/login?callbackUrl=/courses/${params.slug}/learn/${params.lessonId}`
    )
  }

  // Get course with all published content
  const course = await db.course.findUnique({
    where: {
      slug: params.slug,
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

  // Allow access if enrolled OR if the user is the instructor
  if (!enrollment && course.instructorId !== session.user.id) {
    redirect(`/courses/${params.slug}`)
  }

  // Get current lesson
  const currentLesson = await db.lesson.findFirst({
    where: {
      id: params.lessonId,
      isPublished: true,
      chapter: {
        courseId: course.id,
        isPublished: true,
      },
    },
    include: {
      chapter: true,
    },
  })

  if (!currentLesson) {
    // Redirect to first lesson
    const firstLesson = course.chapters[0]?.lessons[0]
    if (firstLesson) {
      redirect(`/courses/${params.slug}/learn/${firstLesson.id}`)
    }
    notFound()
  }

  // Get user progress for all lessons
  const progressRecords = await db.progress.findMany({
    where: {
      lessonId: {
        in: course.chapters.flatMap((ch) => ch.lessons.map((l) => l.id)),
      },
      enrollmentId: enrollment?.id,
    },
  })

  const progressMap = new Map(progressRecords.map((p) => [p.lessonId, p]))

  // Get current lesson progress
  const currentProgress = progressMap.get(currentLesson.id)

  // Calculate overall progress
  const totalLessons = course.chapters.reduce(
    (sum, ch) => sum + ch.lessons.length,
    0
  )
  const completedLessons = progressRecords.filter((p) => p.isCompleted).length
  const overallProgress =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  // Find previous and next lessons
  const allLessons = course.chapters.flatMap((ch) => ch.lessons)
  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id)
  const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
  const nextLesson =
    currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Navigation */}
      <LessonNavigation
        course={course}
        currentLesson={currentLesson}
        overallProgress={overallProgress}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Video/Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video Player */}
          <div className="w-full bg-black">
            <VideoPlayer
              lesson={currentLesson}
              progress={currentProgress}
              enrollmentId={enrollment?.id}
            />
          </div>

          {/* Lesson Content */}
          <div className="flex-1 overflow-y-auto">
            <LessonContent
              lesson={currentLesson}
              previousLesson={previousLesson}
              nextLesson={nextLesson}
              courseSlug={course.slug}
              isCompleted={currentProgress?.isCompleted || false}
              enrollmentId={enrollment?.id}
            />
          </div>
        </div>

        {/* Sidebar - Course Content */}
        <LessonSidebar
          course={course}
          currentLessonId={currentLesson.id}
          progressMap={progressMap}
        />
      </div>
    </div>
  )
}
