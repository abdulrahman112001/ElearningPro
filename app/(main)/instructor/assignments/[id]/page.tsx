"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileCheck2,
  Paperclip,
  Pencil,
  Trash2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AvatarName, CardSkeleton, EmptyState, PageHeader, SectionCard, StatCard, StatGridSkeleton } from "@/components/shared"
import { AssignmentFormDialog } from "@/components/homework/assignment-form-dialog"
import { GradeSubmissionForm } from "@/components/homework/grade-submission-form"
import { intlLocale, relativeTime } from "@/components/school/format"
import { Pill as Badge } from "@/components/homework/pill"

interface Submission {
  id: string
  content: string | null
  linkUrl: string | null
  submittedAt: string
  isLate: boolean
  score: number | null
  feedback: string | null
  gradedAt: string | null
}

interface Detail {
  assignment: {
    id: string
    title: string
    description: string | null
    subject: string | null
    dueAt: string | null
    maxScore: number
    allowLate: boolean
    attachmentUrl: string | null
    group: { id: string; name: string } | null
    course: { id: string; titleAr: string; titleEn: string } | null
    lesson: { id: string; titleAr: string; titleEn: string } | null
  }
  rows: { student: { id: string; name: string | null; email: string | null; image: string | null }; submission: Submission | null }[]
  summary: { targets: number; submitted: number; graded: number; late: number }
}

type Filter = "all" | "toGrade" | "missing" | "graded"

export default function AssignmentDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations("homework")
  const locale = useLocale()
  const router = useRouter()
  const pick = (ar: string, en: string) => (locale === "ar" ? ar || en : en || ar)
  const nf = new Intl.NumberFormat(intlLocale(locale))
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" })
  const [data, setData] = React.useState<Detail | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error" | "notFound">("loading")
  const [editOpen, setEditOpen] = React.useState(false)
  const [filter, setFilter] = React.useState<Filter>("all")

  const load = React.useCallback(() => {
    fetch(`/api/assignments/${params.id}`)
      .then(async (r) => {
        if (r.status === 404) return setState("notFound")
        if (!r.ok) throw new Error()
        const d = await r.json()
        if (d.role !== "teacher") return setState("notFound")
        setData(d)
        setState("ready")
      })
      .catch(() => setState("error"))
  }, [params.id])
  React.useEffect(load, [load])

  async function remove() {
    const res = await fetch(`/api/assignments/${params.id}`, { method: "DELETE" })
    if (!res.ok) return toast.error(t("errors.deleteFailed"))
    toast.success(t("detail.deleted"))
    router.push("/instructor/assignments")
  }

  if (state === "loading") {
    return (
      <div className="space-y-6">
        <StatGridSkeleton count={4} />
        <CardSkeleton />
      </div>
    )
  }
  if (state !== "ready" || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={state === "notFound" ? t("errors.notFound") : t("errors.loadFailed")}
        action={
          <Button asChild variant="outline">
            <Link href="/instructor/assignments">{t("detail.back")}</Link>
          </Button>
        }
      />
    )
  }

  const a = data.assignment
  const rows = data.rows.filter(({ submission: s }) =>
    filter === "all" ? true : filter === "missing" ? !s : filter === "graded" ? !!s?.gradedAt : !!s && !s.gradedAt
  )
  const counts: Record<Filter, number> = {
    all: data.rows.length,
    toGrade: data.summary.submitted - data.summary.graded,
    missing: data.rows.filter((r) => !r.submission).length,
    graded: data.summary.graded,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title={a.title}
        description={[a.subject, a.group?.name ?? (a.course ? pick(a.course.titleAr, a.course.titleEn) : null)].filter(Boolean).join(" · ")}
        breadcrumbs={[{ label: t("teacher.title"), href: "/instructor/assignments" }, { label: a.title }]}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="me-2 h-4 w-4" />
              {t("detail.edit")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="me-2 h-4 w-4" />
                  {t("detail.delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("detail.deleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("detail.deleteHint")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("form.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>{t("detail.delete")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("detail.statStudents")} value={nf.format(data.summary.targets)} icon={Users} />
        <StatCard label={t("detail.statSubmitted")} value={nf.format(data.summary.submitted)} icon={FileCheck2} tone="info" />
        <StatCard label={t("detail.statGraded")} value={nf.format(data.summary.graded)} icon={CheckCircle2} tone="success" />
        <StatCard label={t("detail.statLate")} value={nf.format(data.summary.late)} icon={Clock} tone="warning" />
      </div>

      <SectionCard title={t("detail.about")} icon={CalendarClock}>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t("form.dueAt")}</dt>
            <dd className="font-medium">
              {a.dueAt ? `${dateFmt.format(new Date(a.dueAt))} (${relativeTime(locale, a.dueAt)})` : t("noDueDate")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("form.maxScore")}</dt>
            <dd className="font-medium tabular-nums">{nf.format(a.maxScore)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("form.allowLate")}</dt>
            <dd className="font-medium">{a.allowLate ? t("detail.yes") : t("detail.no")}</dd>
          </div>
        </dl>
        {a.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{a.description}</p>}
        {a.attachmentUrl && (
          <a href={a.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <Paperclip className="h-4 w-4" />
            {t("detail.attachment")}
          </a>
        )}
      </SectionCard>

      <SectionCard
        icon={FileCheck2}
        title={t("detail.submissions")}
        contentClassName="p-0"
        action={
          <div className="flex flex-wrap gap-1">
            {(["all", "toGrade", "missing", "graded"] as Filter[]).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "ghost"} onClick={() => setFilter(f)}>
                {t(`detail.filter.${f}`)} ({nf.format(counts[f])})
              </Button>
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState variant="plain" size="sm" icon={Users} title={t("detail.noRows")} />
        ) : (
          <ul className="divide-y">
            {rows.map(({ student, submission: s }) => (
              <li key={student.id} className="grid gap-3 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,18rem)]">
                <div className="min-w-0 space-y-1.5">
                  <AvatarName name={student.name} image={student.image} size="sm" secondary={<span dir="ltr">{student.email}</span>} />
                  <div className="flex flex-wrap gap-1.5">
                    {!s ? (
                      <Badge tone="danger">{t("status.missing")}</Badge>
                    ) : s.gradedAt ? (
                      <Badge tone="success">{t("status.graded")}</Badge>
                    ) : (
                      <Badge tone="info">{t("status.submitted")}</Badge>
                    )}
                    {s?.isLate && <Badge tone="warning">{t("status.late")}</Badge>}
                  </div>
                </div>
                <div className="min-w-0 text-sm">
                  {s ? (
                    <>
                      <p className="text-xs text-muted-foreground">{t("detail.submittedAt", { date: dateFmt.format(new Date(s.submittedAt)) })}</p>
                      {s.content && <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words">{s.content}</p>}
                      {s.linkUrl && (
                        <a href={s.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline" dir="ltr">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{s.linkUrl}</span>
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">{t("detail.notSubmitted")}</p>
                  )}
                </div>
                <div>
                  {s ? (
                    <GradeSubmissionForm
                      assignmentId={a.id}
                      submissionId={s.id}
                      maxScore={a.maxScore}
                      initialScore={s.score}
                      initialFeedback={s.feedback}
                      onGraded={() => load()}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <AssignmentFormDialog open={editOpen} onOpenChange={setEditOpen} assignment={a} onSaved={() => load()} />
    </div>
  )
}

