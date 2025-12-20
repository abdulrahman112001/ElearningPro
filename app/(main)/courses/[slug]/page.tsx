import { notFound } from "next/navigation"
import Image from "next/image"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { CourseHeader } from "@/components/courses/course-detail/course-header"
import { CourseContent } from "@/components/courses/course-detail/course-content"
import { CourseInstructor } from "@/components/courses/course-detail/course-instructor"
import { CourseReviews } from "@/components/courses/course-detail/course-reviews"
import { CourseSidebar } from "@/components/courses/course-detail/course-sidebar"
import { RelatedCourses } from "@/components/courses/course-detail/related-courses"

interface CoursePageProps {
  params: {
    slug: string
  }
}

export async function generateMetadata({ params }: CoursePageProps) {
  const course = await db.course.findUnique({
    where: { slug: params.slug },
    select: {
      titleEn: true,
      titleAr: true,
      descriptionEn: true,
      thumbnail: true,
    },
  })

  if (!course) return { title: "Course Not Found" }

  return {
    title: course.titleAr || course.titleEn,
    description: course.descriptionEn,
    openGraph: {
      title: course.titleAr || course.titleEn,
      description: course.descriptionEn || "",
      images: course.thumbnail ? [course.thumbnail] : [],
    },
  }
}

export default async function CoursePage({ params }: CoursePageProps) {
  const t = await getTranslations("courses")
  const session = await auth()

  const course = await db.course.findUnique({
    where: {
      slug: params.slug,
      status: "PUBLISHED",
    },
    include: {
      instructor: {
        select: {
          id: true,
          name: true,
          image: true,
          bio: true,
          headline: true,
          _count: {
            select: {
              courses: true,
            },
          },
        },
      },
      category: true,
      chapters: {
        where: { isPublished: true },
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { position: "asc" },
            select: {
              id: true,
              titleEn: true,
              titleAr: true,
              videoDuration: true,
              isFree: true,
            },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
      _count: {
        select: {
          enrollments: true,
          reviews: true,
        },
      },
    },
  })

  if (!course) {
    notFound()
  }

  // Check if user is enrolled
  let enrollment = null
  let userProgress = null

  if (session?.user?.id) {
    enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: course.id,
        },
      },
    })

    if (enrollment) {
      userProgress = await db.progress.findMany({
        where: {
          userId: session.user.id,
          lesson: {
            chapter: {
              courseId: course.id,
            },
          },
        },
        select: {
          lessonId: true,
          isCompleted: true,
        },
      })
    }
  }

  // Get related courses
  const relatedCourses = await db.course.findMany({
    where: {
      categoryId: course.categoryId,
      id: { not: course.id },
      status: "PUBLISHED",
    },
    take: 4,
    select: {
      id: true,
      titleEn: true,
      titleAr: true,
      slug: true,
      thumbnail: true,
      price: true,
      discountPrice: true,
      averageRating: true,
      instructor: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
          reviews: true,
        },
      },
    },
  })

  // Calculate total duration and lessons
  const totalLessons = course.chapters.reduce(
    (acc, chapter) => acc + chapter.lessons.length,
    0
  )

  const totalDuration = course.chapters.reduce(
    (acc, chapter) =>
      acc +
      chapter.lessons.reduce(
        (lessonAcc, lesson) => lessonAcc + (lesson.videoDuration || 0),
        0
      ),
    0
  )

  // Calculate progress percentage
  const completedLessons =
    userProgress?.filter((p) => p.isCompleted).length || 0
  const progressPercentage =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <CourseHeader
        course={course}
        totalLessons={totalLessons}
        totalDuration={totalDuration}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Content */}
          <main className="flex-1 space-y-8">
            {/* Course Description */}
            <div className="bg-background rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4">{t("aboutCourse")}</h2>
              <div
                className="prose prose-gray dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: course.descriptionAr || course.descriptionEn || "",
                }}
              />
            </div>

            {/* What You'll Learn */}
            {course.whatYouLearn && course.whatYouLearn.length > 0 && (
              <div className="bg-background rounded-lg border p-6">
                <h2 className="text-xl font-semibold mb-4">
                  {t("whatYouLearn")}
                </h2>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {course.whatYouLearn.map((objective, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">✓</span>
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Requirements */}
            {course.requirements && course.requirements.length > 0 && (
              <div className="bg-background rounded-lg border p-6">
                <h2 className="text-xl font-semibold mb-4">
                  {t("requirements")}
                </h2>
                <ul className="space-y-2">
                  {course.requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Course Content / Curriculum */}
            <CourseContent
              chapters={course.chapters}
              isEnrolled={!!enrollment}
              userProgress={userProgress}
              courseSlug={course.slug}
            />

            {/* Instructor */}
            <CourseInstructor instructor={course.instructor} />

            {/* Reviews */}
            <CourseReviews
              reviews={course.reviews}
              averageRating={course.averageRating}
              totalReviews={course._count.reviews}
              courseId={course.id}
              isEnrolled={!!enrollment}
            />
          </main>

          {/* Sidebar */}
          <aside className="lg:w-96 shrink-0">
            <CourseSidebar
              course={course}
              enrollment={enrollment}
              progressPercentage={progressPercentage}
              totalLessons={totalLessons}
              completedLessons={completedLessons}
            />
          </aside>
        </div>

        {/* Related Courses */}
        {relatedCourses.length > 0 && (
          <RelatedCourses courses={relatedCourses} />
        )}
      </div>
    </div>
  )
}
