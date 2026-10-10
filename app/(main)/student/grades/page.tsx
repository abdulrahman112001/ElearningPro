import { getLocale, getTranslations } from "next-intl/server"
import { Award, BookMarked, ClipboardCheck, GraduationCap } from "lucide-react"
import { auth } from "@/lib/auth"
import { studentGrades } from "@/lib/school"
import { EmptyState, PageHeader, ScoreBar, SectionCard, StatCard } from "@/components/shared"
import { intlLocale } from "@/components/school/format"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("grades.title") }
}

export default async function StudentGradesPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("school")
  const locale = await getLocale()
  const pick = (ar: string, en: string) => (locale === "ar" ? ar || en : en || ar)
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 })
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" })
  const data = await studentGrades(session.user.id)
  const current = data.terms.find((x) => x.term?.isCurrent) ?? data.terms[0]
  const pct = (v: number | null) => (v === null ? "—" : `${nf.format(v)}%`)

  return (
    <div className="space-y-6">
      <PageHeader icon={GraduationCap} title={t("grades.title")} description={t("grades.subtitle")} />
      {data.terms.length === 0 && data.homework.length === 0 ? (
        <EmptyState icon={BookMarked} title={t("grades.empty")} description={t("grades.emptyHint")} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatCard label={current?.term ? t("grades.termAverage", { term: current.term.name }) : t("grades.overall")} value={pct(current?.overall ?? null)} icon={Award} />
            <StatCard label={t("grades.homeworkAverage")} value={pct(data.homeworkAverage)} icon={ClipboardCheck} tone="info" />
            <StatCard label={t("grades.gradedHomework")} value={nf.format(data.homework.length)} icon={BookMarked} tone="success" />
          </div>

          {data.terms.map((term) => (
            <SectionCard
              key={term.term?.id ?? "none"}
              icon={BookMarked}
              title={term.term?.name ?? t("grades.noTerm")}
              description={t("grades.overallLabel", { value: pct(term.overall) })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                {term.subjects.map((s) => (
                  <div key={s.subject} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="min-w-0 break-words font-medium">{s.subject}</h3>
                    </div>
                    <ScoreBar value={s.average ?? 0} size="sm" valueLabel={pct(s.average)} />
                    <ul className="mt-3 space-y-1 text-sm">
                      {s.marks.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-muted-foreground">
                            {m.title}
                            {m.weight !== 1 && <span className="ms-1 text-xs">({t("grades.weight", { weight: nf.format(m.weight) })})</span>}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {nf.format(m.score)} / {nf.format(m.maxScore)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}

          {data.homework.length > 0 && (
            <SectionCard icon={ClipboardCheck} title={t("grades.homeworkTitle")} contentClassName="p-0">
              <ul className="divide-y">
                {data.homework.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{h.assignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          h.assignment.subject,
                          h.assignment.group?.name ?? (h.assignment.course ? pick(h.assignment.course.titleAr, h.assignment.course.titleEn) : null),
                          h.gradedAt ? dateFmt.format(h.gradedAt) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {h.feedback && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{h.feedback}</p>}
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {nf.format(h.score ?? 0)} / {nf.format(h.assignment.maxScore)}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}
