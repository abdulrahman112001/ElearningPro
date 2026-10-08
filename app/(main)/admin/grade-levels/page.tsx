import { getTranslations } from "next-intl/server"
import { Layers } from "lucide-react"
import { db } from "@/lib/db"
import { PageHeader } from "@/components/shared"
import { GradeLevelsManager } from "@/components/admin/grade-levels-manager"

export async function generateMetadata() {
  const t = await getTranslations("adminGrades")
  return { title: t("title") }
}

// Auth/role is enforced by app/(main)/admin/layout.tsx and the API routes.
export default async function AdminGradeLevelsPage() {
  const t = await getTranslations("adminGrades")
  const ta = await getTranslations("admin")

  const grades = await db.gradeLevel.findMany({
    orderBy: [{ position: "asc" }, { nameEn: "asc" }],
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      stage: true,
      position: true,
      isActive: true,
      _count: { select: { courses: true, students: true, classGroups: true } },
    },
  })

  return (
    <div>
      <PageHeader
        icon={Layers}
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: ta("adminPanel"), href: "/admin" }, { label: t("title") }]}
      />
      <GradeLevelsManager grades={grades} />
    </div>
  )
}
