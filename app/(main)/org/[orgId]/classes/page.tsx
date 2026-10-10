import { getLocale, getTranslations } from "next-intl/server"
import { UsersRound } from "lucide-react"
import { db } from "@/lib/db"
import { PageHeader } from "@/components/shared"
import { ClassesManager } from "@/components/organizations/classes-manager"
import { requireOrgPage } from "../_context"

export default async function OrgClassesPage({ params }: { params: { orgId: string } }) {
  const { org, isManager, session } = await requireOrgPage(params.orgId, ["OWNER", "MANAGER", "TEACHER"])
  const t = await getTranslations("organizations")
  const locale = await getLocale()

  const [classes, staff, students, grades] = await Promise.all([
    db.classGroup.findMany({
      where: { organizationId: org.id, ...(isManager ? {} : { instructorId: session.user.id }) },
      orderBy: { createdAt: "desc" },
      include: {
        instructor: { select: { name: true } },
        gradeLevel: { select: { nameAr: true, nameEn: true } },
        members: { select: { student: { select: { id: true, name: true, email: true } } }, orderBy: { joinedAt: "asc" } },
        scheduleSlots: { select: { dayOfWeek: true, startTime: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      },
    }),
    isManager
      ? db.organizationMember.findMany({
          where: {
            organizationId: org.id,
            role: { in: ["OWNER", "MANAGER", "TEACHER"] },
            user: { role: "INSTRUCTOR", isBlocked: false, instructorProfile: { isApproved: true } },
          },
          select: { user: { select: { id: true, name: true, email: true } } },
        })
      : Promise.resolve([]),
    db.organizationMember.findMany({
      where: { organizationId: org.id, role: "STUDENT" },
      select: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    isManager
      ? db.gradeLevel.findMany({ where: { isActive: true }, orderBy: { position: "asc" }, select: { id: true, nameAr: true, nameEn: true } })
      : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      <PageHeader icon={UsersRound} title={t("classes.title")} description={isManager ? t("classes.subtitle") : t("classes.subtitleTeacher")} />
      <ClassesManager
        orgId={org.id}
        canManage={isManager}
        viewerId={session.user.id}
        teachers={staff.map((m) => ({ id: m.user.id, label: m.user.name || m.user.email }))}
        students={students.map((m) => ({ id: m.user.id, label: `${m.user.name || ""} (${m.user.email})`.trim() }))}
        grades={grades.map((g) => ({ id: g.id, label: locale === "ar" ? g.nameAr : g.nameEn }))}
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          instructorId: c.instructorId,
          gradeLevelId: c.gradeLevelId,
          mode: c.mode,
          location: c.location,
          monthlyFee: c.monthlyFee,
          capacity: c.capacity,
          members: c.members.length,
          teacher: c.instructor.name,
          grade: c.gradeLevel ? (locale === "ar" ? c.gradeLevel.nameAr : c.gradeLevel.nameEn) : null,
          slots: c.scheduleSlots,
          students: c.members.map((m) => m.student),
        }))}
      />
    </div>
  )
}
