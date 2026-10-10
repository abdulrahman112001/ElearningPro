import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  NotebookPen,
  Trophy,
  Unlink,
  Wallet,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { formatPrice } from "@/lib/utils"
import { canViewChild } from "@/lib/reports/parent-links"
import { getChildOverview, type HomeworkState } from "@/lib/reports/child-overview"
import { AvatarName, EmptyState, PageHeader, ScoreBar, SectionCard, StatCard, StatusBadge } from "@/components/shared"
import type { Tone } from "@/components/shared"
import { ConfirmActionButton } from "@/components/parent/confirm-action-button"

interface PageProps {
  params: { studentId: string }
}

export async function generateMetadata() {
  const t = await getTranslations("parent.child")
  return { title: t("metaTitle") }
}

const HOMEWORK_TONE: Record<HomeworkState, Tone> = {
  graded: "success",
  submitted: "info",
  missing: "danger",
  pending: "warning",
}
const ATTENDANCE_TONE: Record<string, Tone> = { PRESENT: "success", LATE: "warning", ABSENT: "danger", EXCUSED: "neutral" }

export default async function ParentChildPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) return null
  // Same response for "not linked" and "does not exist": no probing of ids.
  if (!(await canViewChild(session, params.studentId))) notFound()
  const data = await getChildOverview(params.studentId)
  if (!data) notFound()

  const t = await getTranslations("parent.child")
  const th = await getTranslations("parent.home")
  const locale = await getLocale()
  const isAr = locale === "ar"
  const numFmt = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US", { maximumFractionDigits: 1 })
  const dateFmt = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", { dateStyle: "medium" })
  const dateTimeFmt = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })
  const { student, indicators } = data
  const grade = student.gradeLevel ? (isAr ? student.gradeLevel.nameAr : student.gradeLevel.nameEn) : null
  const pct = (v: number | null) => (v == null ? "—" : `${numFmt.format(v)}%`)

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={<AvatarName name={student.name} image={student.image} size="lg" secondary={grade ?? t("noGrade")} />}
        breadcrumbs={[{ label: th("title"), href: "/parent" }, { label: student.name ?? t("metaTitle") }]}
        actions={
          session.user.role === "PARENT" ? (
            <ConfirmActionButton
              url={`/api/parent/children/${student.id}`}
              label={t("unlink")}
              icon={<Unlink aria-hidden="true" />}
              title={t("unlinkTitle")}
              description={t("unlinkDescription", { name: student.name ?? "" })}
              confirmLabel={t("unlink")}
              successMessage={t("unlinked")}
              redirectTo="/parent"
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("stats.progress")} value={pct(indicators.avgProgress)} icon={GraduationCap} tone="primary" hint={t("stats.courses", { count: indicators.courses })} />
        <StatCard label={t("stats.quizAvg")} value={pct(indicators.avgQuiz)} icon={Trophy} tone="success" />
        <StatCard label={t("stats.attendance")} value={pct(indicators.attendanceRate)} icon={CalendarCheck} tone="info" hint={t("stats.last90")} />
        <StatCard
          label={t("stats.feesDue")}
          value={indicators.feesDue > 0 ? formatPrice(indicators.feesDue, "EGP", locale) : "—"}
          icon={Wallet}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={BookOpen} title={t("courses.title")}>
          {data.enrollments.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={BookOpen} title={t("courses.empty")} />
          ) : (
            <ul className="space-y-4">
              {data.enrollments.map((e) => (
                <li key={e.id}>
                  <ScoreBar
                    value={Math.round(e.progress)}
                    label={<span className="line-clamp-1">{isAr ? e.course.titleAr : e.course.titleEn}</span>}
                    neutralTone
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={Trophy} title={t("quizzes.title")}>
          {data.quizAttempts.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={Trophy} title={t("quizzes.empty")} />
          ) : (
            <ul className="divide-y">
              {data.quizAttempts.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{(isAr && q.quiz.titleAr) || q.quiz.title}</p>
                    <p className="text-xs text-muted-foreground">{q.completedAt ? dateFmt.format(q.completedAt) : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{pct(Math.round(q.score))}</span>
                    {q.needsGrading ? (
                      <StatusBadge status="PENDING" label={t("quizzes.grading")} />
                    ) : (
                      <StatusBadge status={q.passed ? "PASSED" : "FAILED"} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={CalendarCheck} title={t("attendance.title")} description={t("attendance.description")}>
          {data.attendance.total === 0 ? (
            <EmptyState variant="plain" size="sm" icon={CalendarCheck} title={t("attendance.empty")} />
          ) : (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const).map((s) => (
                  <div key={s} className="rounded-md bg-muted/40 p-2.5 text-center">
                    <dt className="text-xs text-muted-foreground">{t(`attendance.status.${s}`)}</dt>
                    <dd className="text-lg font-bold tabular-nums">{numFmt.format(data.attendance.counts[s] ?? 0)}</dd>
                  </div>
                ))}
              </dl>
              {data.attendance.recentAbsences.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">{t("attendance.recent")}</h3>
                  <ul className="divide-y text-sm">
                    {data.attendance.recentAbsences.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="min-w-0 truncate">
                          {a.session.title || a.session.group.name} · {dateFmt.format(a.session.startsAt)}
                        </span>
                        <StatusBadge status={a.status} label={t(`attendance.status.${a.status}`)} tone={ATTENDANCE_TONE[a.status]} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Wallet} title={t("fees.title")}>
          {data.fees.items.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={Wallet} title={t("fees.empty")} />
          ) : (
            <ul className="divide-y text-sm">
              {data.fees.items.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0">
                  <span className="min-w-0 truncate">
                    {f.group.name} · <span dir="ltr">{f.period}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-destructive">{formatPrice(f.amount, "EGP", locale)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 pt-2.5 font-semibold">
                <span>{t("fees.total")}</span>
                <span className="tabular-nums">{formatPrice(data.fees.total, "EGP", locale)}</span>
              </li>
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={ClipboardList} title={t("homework.title")}>
          {data.homework.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={ClipboardList} title={t("homework.empty")} />
          ) : (
            <ul className="divide-y">
              {data.homework.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{h.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[h.subject, h.dueAt ? t("homework.due", { date: dateFmt.format(h.dueAt) }) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.score != null && (
                      <span className="text-sm font-semibold tabular-nums" dir="ltr">
                        {numFmt.format(h.score)}/{numFmt.format(h.maxScore)}
                      </span>
                    )}
                    <StatusBadge status={h.state} label={t(`homework.state.${h.state}`)} tone={HOMEWORK_TONE[h.state]} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={NotebookPen} title={t("grades.title")}>
          {data.gradeEntries.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={NotebookPen} title={t("grades.empty")} />
          ) : (
            <ul className="space-y-3">
              {data.gradeEntries.map((g) => (
                <li key={g.id}>
                  <ScoreBar
                    value={g.score}
                    max={g.maxScore || 1}
                    label={<span className="line-clamp-1">{g.subject} · {g.title}</span>}
                    valueLabel={<span dir="ltr">{numFmt.format(g.score)}/{numFmt.format(g.maxScore)}</span>}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={AlertTriangle} title={t("alerts.title")}>
          {data.alerts.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={AlertTriangle} title={t("alerts.empty")} />
          ) : (
            <ul className="space-y-3">
              {data.alerts.map((a) => (
                <li key={a.id} className="rounded-md border border-warning/30 bg-warning/5 p-3">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">{a.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {[a.sender.name, dateFmt.format(a.createdAt)].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={CalendarClock} title={t("upcoming.title")}>
          {data.upcoming.sessions.length + data.upcoming.liveClasses.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={CalendarClock} title={t("upcoming.empty")} />
          ) : (
            <ul className="divide-y text-sm">
              {data.upcoming.sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
                  <span className="min-w-0 truncate">
                    {s.title || s.group.name}
                    {s.location ? ` · ${s.location}` : ""}
                  </span>
                  <span className="text-muted-foreground">{dateTimeFmt.format(s.startsAt)}</span>
                </li>
              ))}
              {data.upcoming.liveClasses.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{(isAr && l.titleAr) || l.title}</span>
                    <StatusBadge status={l.status} />
                  </span>
                  <span className="text-muted-foreground">{dateTimeFmt.format(l.scheduledAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
