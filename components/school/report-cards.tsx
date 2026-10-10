"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, ArrowLeft, FileText, Printer, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AvatarName, CardSkeleton, EmptyState, PageHeader, ScoreBar, SectionCard, TableSkeleton } from "@/components/shared"
import { intlLocale, readError } from "./format"
import { useSchoolData } from "./subjects-manager"

interface ReportData {
  organization: { id: string; name: string; logoUrl: string | null; address: string | null; phone: string | null }
  group: { id: string; name: string; homeroom: { id: string; name: string | null } | null }
  term: { id: string; name: string; startsAt: string; endsAt: string }
  cards: {
    student: { id: string; name: string | null; email: string | null; image: string | null }
    subjects: { subject: string; percent: number | null; entries: number }[]
    overall: number | null
    attendance: { present: number; late: number; absent: number; excused: number; rate: number | null }
  }[]
}

function useReport(orgId: string, groupId: string, termId: string) {
  const [data, setData] = React.useState<ReportData | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  React.useEffect(() => {
    if (!groupId) return
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({ groupId, ...(termId ? { termId } : {}) })
    fetch(`/api/school/${orgId}/report-cards?${qs}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await readError(r)
          throw new Error(err.code === "no_term" ? "no_term" : r.status === 403 ? "forbidden" : "failed")
        }
        setData(await r.json())
      })
      .catch((e: Error) => {
        setData(null)
        setError(e.message)
      })
      .finally(() => setLoading(false))
  }, [orgId, groupId, termId])
  return { data, error, loading }
}

/** Class + term picker with a preview table and a link to the printable cards. */
export function ReportCardsPicker({ orgId }: { orgId: string }) {
  const t = useTranslations("school")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 })
  const { data: school, error: schoolError } = useSchoolData(orgId)
  const [groupId, setGroupId] = React.useState("")
  const [termId, setTermId] = React.useState("")

  React.useEffect(() => {
    if (!school) return
    if (!groupId && school.classes[0]) setGroupId(school.classes[0].id)
    if (!termId) setTermId((school.terms.find((x) => x.isCurrent) ?? school.terms[0])?.id ?? "")
  }, [school, groupId, termId])

  const { data, error, loading } = useReport(orgId, groupId, termId)
  const pct = (v: number | null) => (v === null ? "—" : `${nf.format(v)}%`)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title={t("reportCards.title")}
        description={t("reportCards.subtitle")}
        actions={
          data && (
            <Button asChild>
              <Link href={`/org/${orgId}/school/report-cards/print?groupId=${groupId}&termId=${data.term.id}`}>
                <Printer className="me-2 h-4 w-4" />
                {t("reportCards.openPrintable")}
              </Link>
            </Button>
          )
        }
      >
        {school && school.classes.length > 0 && (
          <div className="grid gap-3 rounded-lg border bg-card p-3 shadow-soft sm:grid-cols-2 sm:p-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("reportCards.class")}</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {school.classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("reportCards.term")}</Label>
              <Select value={termId} onValueChange={setTermId} disabled={school.terms.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={t("reportCards.noTerms")} />
                </SelectTrigger>
                <SelectContent>
                  {school.terms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </PageHeader>

      {schoolError ? (
        <EmptyState icon={AlertTriangle} title={t("errors.loadFailed")} />
      ) : !school ? (
        <TableSkeleton rows={5} columns={4} />
      ) : school.classes.length === 0 ? (
        <EmptyState icon={Users} title={t("noClasses")} description={t("noClassesHint")} />
      ) : school.terms.length === 0 || error === "no_term" ? (
        <EmptyState
          icon={FileText}
          title={t("reportCards.noTerms")}
          description={t("reportCards.noTermsHint")}
          action={
            <Button asChild variant="outline">
              <Link href={`/org/${orgId}/school/terms`}>{t("tabs.terms")}</Link>
            </Button>
          }
        />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title={error === "forbidden" ? t("reportCards.forbidden") : t("errors.loadFailed")} />
      ) : !data || loading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : data.cards.length === 0 ? (
        <EmptyState icon={Users} title={t("reportCards.noStudents")} />
      ) : (
        <SectionCard icon={Users} title={`${data.group.name} · ${data.term.name}`} contentClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="ps-4 sm:ps-6">{t("reportCards.student")}</TableHead>
                <TableHead className="min-w-[8rem]">{t("reportCards.overall")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("reportCards.attendance")}</TableHead>
                <TableHead className="hidden pe-4 sm:pe-6 lg:table-cell">{t("reportCards.subjectsCol")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.cards.map((c) => (
                <TableRow key={c.student.id}>
                  <TableCell className="ps-4 sm:ps-6">
                    <AvatarName name={c.student.name} image={c.student.image} size="sm" className="max-w-[11rem] sm:max-w-[16rem]" />
                  </TableCell>
                  <TableCell>
                    {c.overall === null ? <span className="text-muted-foreground">—</span> : <ScoreBar value={c.overall} size="sm" valueLabel={pct(c.overall)} />}
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">{pct(c.attendance.rate)}</TableCell>
                  <TableCell className="hidden pe-4 text-xs text-muted-foreground sm:pe-6 lg:table-cell">
                    {c.subjects
                      .filter((s) => s.percent !== null)
                      .map((s) => `${s.subject}: ${pct(s.percent)}`)
                      .join(" · ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </div>
  )
}

/** Printable report cards: one student per page. Comments are typed here and never saved. */
export function PrintableReportCards({ orgId, groupId, termId }: { orgId: string; groupId: string; termId: string }) {
  const t = useTranslations("school")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 })
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" })
  const { data, error } = useReport(orgId, groupId, termId)
  const [comments, setComments] = React.useState<Record<string, string>>({})
  const pct = (v: number | null) => (v === null ? "—" : `${nf.format(v)}%`)

  const toolbar = (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Button variant="outline" asChild>
        <Link href={`/org/${orgId}/school/report-cards`}>
          <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
          {t("reportCards.back")}
        </Link>
      </Button>
      <p className="text-sm text-muted-foreground">{t("reportCards.commentHint")}</p>
      <Button onClick={() => window.print()} disabled={!data}>
        <Printer className="me-2 h-4 w-4" />
        {t("reportCards.print")}
      </Button>
    </div>
  )

  if (!groupId) return <EmptyState icon={FileText} title={t("reportCards.pickClass")} />
  if (error) {
    return (
      <>
        {toolbar}
        <EmptyState icon={AlertTriangle} title={error === "forbidden" ? t("reportCards.forbidden") : error === "no_term" ? t("reportCards.noTerms") : t("errors.loadFailed")} />
      </>
    )
  }
  if (!data) {
    return (
      <>
        {toolbar}
        <CardSkeleton />
      </>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body * { visibility: hidden !important; }
          #report-cards, #report-cards * { visibility: visible !important; }
          #report-cards { position: absolute; inset-inline-start: 0; top: 0; width: 100%; }
          .report-card { break-after: page; page-break-after: always; box-shadow: none !important; border: none !important; }
          .report-card:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      {toolbar}
      <div id="report-cards" className="space-y-8">
        {data.cards.length === 0 && <EmptyState icon={Users} title={t("reportCards.noStudents")} />}
        {data.cards.map((c) => (
          <article key={c.student.id} className="report-card mx-auto max-w-3xl rounded-lg border bg-card p-5 text-card-foreground shadow-soft sm:p-8 print:bg-white print:text-black">
            <header className="flex flex-wrap items-center gap-4 border-b pb-4">
              {data.organization.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.organization.logoUrl} alt="" className="h-14 w-14 rounded object-contain" />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold">{data.organization.name}</h2>
                {data.organization.address && <p className="text-xs text-muted-foreground print:text-black">{data.organization.address}</p>}
              </div>
              <div className="text-end">
                <p className="font-semibold">{t("reportCards.cardTitle")}</p>
                <p className="text-sm text-muted-foreground print:text-black">{data.term.name}</p>
              </div>
            </header>

            <dl className="grid gap-3 py-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground print:text-black">{t("reportCards.student")}</dt>
                <dd className="font-semibold">{c.student.name ?? c.student.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground print:text-black">{t("reportCards.class")}</dt>
                <dd className="font-semibold">{data.group.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground print:text-black">{t("reportCards.period")}</dt>
                <dd className="font-semibold">
                  {dateFmt.format(new Date(data.term.startsAt))} – {dateFmt.format(new Date(data.term.endsAt))}
                </dd>
              </div>
            </dl>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y bg-muted/40 print:bg-transparent">
                  <th className="px-3 py-2 text-start font-medium">{t("reportCards.subject")}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("reportCards.average")}</th>
                </tr>
              </thead>
              <tbody>
                {c.subjects.map((s) => (
                  <tr key={s.subject} className="border-b">
                    <td className="px-3 py-2">{s.subject}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{pct(s.percent)}</td>
                  </tr>
                ))}
                {c.subjects.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-center text-muted-foreground">
                      {t("reportCards.noMarks")}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="px-3 py-2">{t("reportCards.overall")}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{pct(c.overall)}</td>
                </tr>
              </tfoot>
            </table>

            <section className="mt-5 rounded-md border p-3 text-sm">
              <h3 className="mb-2 font-medium">{t("reportCards.attendance")}</h3>
              <p className="tabular-nums">
                {t("reportCards.attendanceLine", {
                  rate: pct(c.attendance.rate),
                  present: nf.format(c.attendance.present),
                  late: nf.format(c.attendance.late),
                  absent: nf.format(c.attendance.absent),
                  excused: nf.format(c.attendance.excused),
                })}
              </p>
            </section>

            <section className="mt-5">
              <Label htmlFor={`cm-${c.student.id}`} className="mb-2 block font-medium">
                {t("reportCards.comment")}
              </Label>
              <Textarea
                id={`cm-${c.student.id}`}
                rows={3}
                value={comments[c.student.id] ?? ""}
                onChange={(e) => setComments((m) => ({ ...m, [c.student.id]: e.target.value }))}
                className="print:hidden"
              />
              <p className="hidden min-h-[4rem] whitespace-pre-wrap rounded border p-2 text-sm print:block">{comments[c.student.id] ?? ""}</p>
            </section>

            <footer className="mt-8 grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-muted-foreground print:text-black">{t("reportCards.homeroom")}</p>
                <p className="mt-6 border-t pt-1">{data.group.homeroom?.name ?? ""}</p>
              </div>
              <div>
                <p className="text-muted-foreground print:text-black">{t("reportCards.principal")}</p>
                <p className="mt-6 border-t pt-1">&nbsp;</p>
              </div>
            </footer>
          </article>
        ))}
      </div>
    </>
  )
}
