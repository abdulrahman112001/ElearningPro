import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { CreateCourseForm } from "@/components/instructor/create-course-form"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("createCourse"),
  }
}

export default async function CreateCoursePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login?callbackUrl=/instructor/courses/create")
  }

  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/")
  }

  const categories = await db.category.findMany({
    where: { parentId: null },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
    },
    orderBy: { nameEn: "asc" },
  })

  return <CreateCourseForm categories={categories} />
}
