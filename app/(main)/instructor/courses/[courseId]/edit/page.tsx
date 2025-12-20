import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { CourseEditor } from "@/components/instructor/course-editor"

interface EditCoursePageProps {
  params: {
    courseId: string
  }
}

export async function generateMetadata({ params }: EditCoursePageProps) {
  const t = await getTranslations("instructor")
  return {
    title: t("editCourse"),
  }
}

export default async function EditCoursePage({ params }: EditCoursePageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/")
  }

  const course = await db.course.findUnique({
    where: {
      id: params.courseId,
      instructorId: session.user.id,
    },
    include: {
      chapters: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
          },
        },
      },
      category: true,
    },
  })

  if (!course) {
    notFound()
  }

  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { nameEn: "asc" },
  })

  return (
    <div className="min-h-screen bg-muted/30">
      <CourseEditor course={course} categories={categories} />
    </div>
  )
}
