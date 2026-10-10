import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCourseAccess } from "@/lib/access"
import { VideoPlayer } from "@/components/learn/course-video-player"
import { CourseSidebar } from "@/components/learn/course-sidebar"
import { CourseContent } from "@/components/learn/course-content"
import { CourseNavigation } from "@/components/learn/course-navigation"
import { LessonQuestions } from "@/components/learn/lesson-questions"
import { CourseTutor } from "@/components/ai/course-tutor"

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

  // Enrollment, teacher subscription, owner or admin
  const access = await getCourseAccess(session.user, course)
  if (!access.allowed) {
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
        attachments: true,
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
    chapter.lessons.map(({ videoUrl, ...lesson }) => ({
      ...lesson,
      chapterId: chapter.id,
      chapterTitle: chapter.titleEn,
      chapterTitleAr: chapter.titleAr,
    }))
  )

  // Video protection: the video URL never goes into the page. The player asks
  // /api/lessons/[id]/play for it, which enforces view and device limits.
  const stripVideo = <T extends { videoUrl?: string | null }>({ videoUrl, ...rest }: T) => ({
    ...rest,
    hasVideo: !!videoUrl,
  })
  const safeChapters = course.chapters.map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.map(stripVideo),
  }))
  const safeCourse = {
    id: course.id,
    slug: course.slug,
    titleEn: course.titleEn,
    titleAr: course.titleAr,
  }
  const safeLesson = stripVideo(currentLesson)

  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id)
  const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
  const nextLesson =
    currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <CourseSidebar
        course={safeCourse}
        chapters={safeChapters}
        currentLessonId={currentLesson.id}
        userId={session.user.id}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Video Player */}
        <VideoPlayer
          key={currentLesson.id}
          lesson={safeLesson}
          progress={progress}
          userId={session.user.id}
          courseSlug={params.slug}
          nextLesson={nextLesson}
        />

        {/* Lesson Content & Navigation */}
        <div className="flex-1 overflow-y-auto">
          <div className="container max-w-4xl mx-auto p-6 space-y-6">
            <CourseContent lesson={safeLesson} />

            <CourseNavigation
              courseSlug={params.slug}
              previousLesson={previousLesson}
              nextLesson={nextLesson}
            />

            {/* Lesson Q&A: students ask, the teacher answers */}
            <LessonQuestions
              key={currentLesson.id}
              lessonId={currentLesson.id}
              currentUser={{
                id: session.user.id,
                name: session.user.name,
                image: session.user.image,
              }}
              isInstructor={course.instructorId === session.user.id}
            />
          </div>
          {/* AI tutor grounded in this course (floating button + chat panel) */}
          <CourseTutor courseId={course.id} lessonId={currentLesson.id} />
        </div>
      </div>
    </div>
  )
}
