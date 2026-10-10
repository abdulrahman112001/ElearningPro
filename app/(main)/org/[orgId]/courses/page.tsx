import { getLocale, getTranslations } from "next-intl/server"
import { BookOpen } from "lucide-react"
import { db } from "@/lib/db"
import { PageHeader } from "@/components/shared"
import { CoursesManager } from "@/components/organizations/courses-manager"
import { requireOrgPage } from "../_context"

const SELECT = {
  id: true, titleAr: true, titleEn: true, slug: true, status: true, instructorId: true,
  instructor: { select: { name: true } },
} as const

export default async function OrgCoursesPage({ params }: { params: { orgId: string } }) {
  const { org, isManager, session } = await requireOrgPage(params.orgId, ["OWNER", "MANAGER", "TEACHER"])
  const t = await getTranslations("organizations")
  const locale = await getLocale()
  const [courses, mine] = await Promise.all([
    db.course.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" }, select: SELECT }),
    db.course.findMany({
      where: { instructorId: session.user.id, organizationId: null, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      select: SELECT,
    }),
  ])
  type Row = (typeof courses)[number]
  const map = (c: Row) => ({
    id: c.id,
    title: (locale === "ar" ? c.titleAr || c.titleEn : c.titleEn || c.titleAr) ?? "",
    slug: c.slug,
    status: c.status,
    instructorId: c.instructorId,
    instructorName: c.instructor.name,
  })
  return (
    <div className="space-y-6">
      <PageHeader icon={BookOpen} title={t("courses.title")} description={t("courses.subtitle")} />
      <CoursesManager
        orgId={org.id}
        viewerId={session.user.id}
        canManage={isManager}
        courses={courses.map(map)}
        attachable={mine.map(map)}
      />
    </div>
  )
}
