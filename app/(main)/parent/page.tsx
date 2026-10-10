import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  HeartHandshake,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatPrice } from "@/lib/utils"
import { getChildCardIndicators } from "@/lib/reports/child-overview"
import { Button } from "@/components/ui/button"
import { AvatarName, EmptyState, PageHeader, ScoreBar, SectionCard, StatCard } from "@/components/shared"
import { AddChildForm } from "@/components/parent/add-child-form"

export async function generateMetadata() {
  const t = await getTranslations("parent.home")
  return { title: t("title") }
}

export default async function ParentHomePage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("parent.home")
  const ti = await getTranslations("parent.indicators")
  const tr = await getTranslations("parent.relations")
  const locale = await getLocale()
  const isAr = locale === "ar"
  const numFmt = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US")

  const links = await db.parentLink.findMany({
    where: { parentId: session.user.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      relation: true,
      student: {
        select: { id: true, name: true, image: true, gradeLevel: { select: { nameAr: true, nameEn: true } } },
      },
    },
  })
  const children = await Promise.all(
    links.map(async (l) => ({ ...l, indicators: await getChildCardIndicators(l.student.id) }))
  )
  const totalFees = children.reduce((a, c) => a + c.indicators.feesDue, 0)
  const totalAlerts = children.reduce((a, c) => a + c.indicators.alerts, 0)
  const totalMissing = children.reduce((a, c) => a + c.indicators.missingHomework, 0)

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader icon={HeartHandshake} title={t("title")} description={t("description")} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("stats.children")} value={numFmt.format(children.length)} icon={Users} tone="primary" />
        <StatCard
          label={t("stats.feesDue")}
          value={totalFees > 0 ? formatPrice(totalFees, "EGP", locale) : "—"}
          icon={Wallet}
          tone="warning"
        />
        <StatCard label={t("stats.missingHomework")} value={numFmt.format(totalMissing)} icon={ClipboardList} tone="danger" />
        <StatCard label={t("stats.alerts")} value={numFmt.format(totalAlerts)} icon={AlertTriangle} tone="info" hint={t("stats.last30")} />
      </div>

      {children.length === 0 ? (
        <EmptyState icon={Users} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map(({ student, relation, indicators }) => {
            const grade = student.gradeLevel ? (isAr ? student.gradeLevel.nameAr : student.gradeLevel.nameEn) : null
            return (
              <article key={student.id} className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-soft sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <AvatarName
                    name={student.name}
                    image={student.image}
                    size="lg"
                    secondary={[grade, relation ? tr(relation as "father") : null].filter(Boolean).join(" · ") || undefined}
                  />
                </div>
                <ScoreBar
                  value={indicators.avgProgress}
                  label={ti("progress", { count: indicators.courses })}
                  neutralTone
                  size="sm"
                />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Indicator icon={BookOpen} label={ti("quizAvg")} value={indicators.avgQuiz == null ? "—" : `${numFmt.format(indicators.avgQuiz)}%`} />
                  <Indicator
                    icon={CalendarCheck}
                    label={ti("attendance")}
                    value={indicators.attendanceRate == null ? "—" : `${numFmt.format(indicators.attendanceRate)}%`}
                  />
                  <Indicator
                    icon={ClipboardList}
                    label={ti("missingHomework")}
                    value={numFmt.format(indicators.missingHomework)}
                    warn={indicators.missingHomework > 0}
                  />
                  <Indicator
                    icon={Wallet}
                    label={ti("feesDue")}
                    value={indicators.feesDue > 0 ? formatPrice(indicators.feesDue, "EGP", locale) : "—"}
                    warn={indicators.feesDue > 0}
                  />
                </dl>
                <Button asChild variant="outline" className="mt-auto">
                  <Link href={`/parent/children/${student.id}`}>
                    {t("viewDetails")}
                    <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )
          })}
        </div>
      )}

      <SectionCard icon={UserPlus} title={t("addTitle")} description={t("addDescription")}>
        <AddChildForm />
      </SectionCard>
    </div>
  )
}

function Indicator({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof BookOpen
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-md bg-muted/40 p-2.5">
      <Icon className={warn ? "mt-0.5 h-4 w-4 shrink-0 text-destructive" : "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"} aria-hidden="true" />
      <div className="min-w-0">
        <dt className="truncate text-xs text-muted-foreground">{label}</dt>
        <dd className={warn ? "font-semibold tabular-nums text-destructive" : "font-semibold tabular-nums"}>{value}</dd>
      </div>
    </div>
  )
}
