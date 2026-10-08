import type { Prisma } from "@prisma/client"
import { getTranslations } from "next-intl/server"
import { GraduationCap } from "lucide-react"
import { db } from "@/lib/db"
import { PageHeader } from "@/components/shared"
import { InstructorsTable } from "@/components/admin/instructors-table"
import {
  INSTRUCTOR_STATUS_TABS,
  isInstructorStatusTab,
  type InstructorStatusTab,
} from "@/components/admin/instructor-review/status-tabs"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("instructors"),
  }
}

/**
 * Filters matching effectiveApplicationStatus(): isApproved wins; an
 * unapproved profile marked APPROVED reads as PENDING; no profile is DRAFT.
 */
const STATUS_WHERE: Record<InstructorStatusTab, Prisma.UserWhereInput> = {
  all: {},
  pending: {
    instructorProfile: {
      is: { isApproved: false, applicationStatus: { in: ["PENDING", "APPROVED"] } },
    },
  },
  draft: {
    OR: [
      { instructorProfile: { is: { isApproved: false, applicationStatus: "DRAFT" } } },
      { instructorProfile: { is: null } },
    ],
  },
  approved: { instructorProfile: { is: { isApproved: true } } },
  rejected: {
    instructorProfile: { is: { isApproved: false, applicationStatus: "REJECTED" } },
  },
}

// Auth/role is enforced by app/(main)/admin/layout.tsx and the API routes.
export default async function AdminInstructorsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; search?: string }
}) {
  const t = await getTranslations("admin")
  const tr = await getTranslations("adminInstructorReview")
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1)
  const limit = 20
  const search = searchParams.search?.trim()

  const base: Prisma.UserWhereInput = { role: "INSTRUCTOR" }

  const countValues = await Promise.all(
    INSTRUCTOR_STATUS_TABS.map((tab) => db.user.count({ where: { AND: [base, STATUS_WHERE[tab]] } }))
  )
  const counts = Object.fromEntries(
    INSTRUCTOR_STATUS_TABS.map((tab, i) => [tab, countValues[i]])
  ) as Record<InstructorStatusTab, number>

  // Default to the review queue when there is something to review.
  const status: InstructorStatusTab = isInstructorStatusTab(searchParams.status)
    ? searchParams.status
    : counts.pending > 0
      ? "pending"
      : "all"

  const where: Prisma.UserWhereInput = {
    AND: [
      base,
      STATUS_WHERE[status],
      search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { instructorProfile: { is: { specialization: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {},
    ],
  }

  const [instructors, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isBlocked: true,
        createdAt: true,
        instructorProfile: {
          select: {
            isApproved: true,
            applicationStatus: true,
            submittedAt: true,
            specialization: true,
            governorate: true,
            yearsOfExperience: true,
          },
        },
        _count: { select: { courses: true } },
      },
      // Pending queue: oldest submission first so nobody waits forever.
      orderBy:
        status === "pending"
          ? [{ instructorProfile: { submittedAt: "asc" } }, { createdAt: "asc" }]
          : { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ])

  return (
    <div>
      <PageHeader
        icon={GraduationCap}
        title={t("instructors")}
        description={tr("description")}
        breadcrumbs={[{ label: t("adminPanel"), href: "/admin" }, { label: t("instructors") }]}
      />

      <InstructorsTable
        instructors={instructors}
        status={status}
        counts={counts}
        pagination={{
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }}
      />
    </div>
  )
}
