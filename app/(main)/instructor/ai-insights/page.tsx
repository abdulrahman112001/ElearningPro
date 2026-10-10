"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { AlertTriangle, Brain, Lightbulb, Loader2, Send, Sparkles, Target, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AvatarName, EmptyState, ListSkeleton, PageHeader, SectionCard, scoreTone, toneStyles } from "@/components/shared"
import { AiDisabledNotice, aiErrorKind } from "@/components/ai/ai-disabled-notice"
import { cn } from "@/lib/utils"

const ALL = "__all__"
const WEAKEST = 15

interface RankingRow {
  studentId: string
  name: string | null
  image: string | null
  hasGuardianEmail: boolean
  averageScore: number
  quizzesTaken: number
  quizzesPassed: number
}

interface Diagnosis {
  summary: string
  weakTopics: { topic: string; evidence: string }[]
  recommendations: string[]
  messageToStudent: string
  messageToParent: string
}

export default function AiInsightsPage() {
  const t = useTranslations("ai")
  const locale = useLocale()
  const [courses, setCourses] = React.useState<{ id: string; label: string }[]>([])
  const [courseId, setCourseId] = React.useState(ALL)
  const [rows, setRows] = React.useState<RankingRow[] | null>(null)
  const [disabled, setDisabled] = React.useState<null | "not_configured" | "daily_limit">(null)
  const [active, setActive] = React.useState<RankingRow | null>(null)
  const [analyzing, setAnalyzing] = React.useState(false)
  const [diagnosis, setDiagnosis] = React.useState<Diagnosis | null>(null)
  const [studentMsg, setStudentMsg] = React.useState("")
  const [parentMsg, setParentMsg] = React.useState("")
  const [sending, setSending] = React.useState<null | "student" | "parent">(null)
  const resultRef = React.useRef<HTMLDivElement>(null)

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 1 })

  React.useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && (!s.configured ? setDisabled("not_configured") : s.exceeded ? setDisabled("daily_limit") : null))
      .catch(() => undefined)
    fetch("/api/instructor/courses")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: string; titleAr: string; titleEn: string }[]) =>
        setCourses(
          list.map((c) => ({ id: c.id, label: (locale === "ar" ? c.titleAr || c.titleEn : c.titleEn || c.titleAr) ?? "" }))
        )
      )
      .catch(() => setCourses([]))
  }, [locale])

  React.useEffect(() => {
    let cancelled = false
    setRows(null)
    const qs = courseId !== ALL ? `?courseId=${encodeURIComponent(courseId)}` : ""
    fetch(`/api/instructor/results${qs}`)
      .then((r) => (r.ok ? r.json() : { ranking: [] }))
      .then((d: { ranking: RankingRow[] }) => {
        if (cancelled) return
        // Weakest first (the results ranking is sorted best first).
        setRows([...d.ranking].reverse().slice(0, WEAKEST))
      })
      .catch(() => !cancelled && setRows([]))
    return () => {
      cancelled = true
    }
  }, [courseId])

  const analyze = async (row: RankingRow) => {
    setActive(row)
    setDiagnosis(null)
    setAnalyzing(true)
    try {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: row.studentId, courseId: courseId !== ALL ? courseId : undefined, language: locale }),
      })
      if (!res.ok) {
        const { kind, message } = await aiErrorKind(res)
        if (kind !== "other") setDisabled(kind)
        else toast.error(message || t("diagnoseFailed"))
        return
      }
      const data: { diagnosis: Diagnosis } = await res.json()
      setDiagnosis(data.diagnosis)
      setStudentMsg(data.diagnosis.messageToStudent)
      setParentMsg(data.diagnosis.messageToParent)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
    } catch {
      toast.error(t("diagnoseFailed"))
    } finally {
      setAnalyzing(false)
    }
  }

  const sendAlert = async (toGuardian: boolean) => {
    if (!active) return
    const message = (toGuardian ? parentMsg : studentMsg).trim()
    if (!message) return
    setSending(toGuardian ? "parent" : "student")
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: active.studentId,
          title: toGuardian ? t("parentAlertTitle") : t("studentAlertTitle"),
          message: message.slice(0, 3000),
          toGuardian,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.code === "no_guardian_email" ? t("noGuardianEmail") : body.error || t("sendFailed"))
        return
      }
      toast.success(toGuardian ? t("sentToParent") : t("sentToStudent"))
    } catch {
      toast.error(t("sendFailed"))
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Brain} title={t("insightsTitle")} description={t("insightsDescription")} />

      {disabled === "not_configured" && <AiDisabledNotice reason="not_configured" />}

      <div className="flex flex-col gap-2 sm:max-w-xs">
        <Label>{t("course")}</Label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allCourses")}</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <SectionCard
          className="lg:col-span-2"
          icon={AlertTriangle}
          title={t("weakestStudents")}
          description={t("weakestDescription")}
          contentClassName="p-0"
        >
          {rows === null ? (
            <div className="p-4">
              <ListSkeleton rows={5} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Users} title={t("noStudents")} description={t("noStudentsDescription")} variant="plain" size="sm" />
          ) : (
            <ul className="divide-y">
              {rows.map((row) => (
                <li
                  key={row.studentId}
                  className={cn("flex items-center gap-3 px-4 py-3", active?.studentId === row.studentId && "bg-primary/5")}
                >
                  <AvatarName
                    name={row.name}
                    image={row.image}
                    size="sm"
                    secondary={t("quizzesPassedOf", { passed: row.quizzesPassed, total: row.quizzesTaken })}
                    className="min-w-0 flex-1"
                  />
                  <span className={cn("shrink-0 text-sm font-bold tabular-nums", toneStyles[scoreTone(row.averageScore)].text)}>
                    {nf.format(row.averageScore)}%
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1"
                    disabled={analyzing || disabled === "not_configured"}
                    onClick={() => analyze(row)}
                  >
                    {analyzing && active?.studentId === row.studentId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{t("analyze")}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div ref={resultRef} className="lg:col-span-3">
          <SectionCard icon={Sparkles} title={active ? t("diagnosisFor", { name: active.name ?? "" }) : t("diagnosis")}>
            {disabled === "daily_limit" ? (
              <AiDisabledNotice reason="daily_limit" />
            ) : analyzing ? (
              <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                {t("analyzing")}
              </div>
            ) : !diagnosis ? (
              <EmptyState icon={Brain} title={t("pickStudent")} description={t("pickStudentDescription")} variant="plain" size="sm" />
            ) : (
              <div className="space-y-5 text-sm">
                <p className="leading-relaxed" dir="auto">
                  {diagnosis.summary}
                </p>

                {diagnosis.weakTopics.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="flex items-center gap-2 font-semibold">
                      <Target className="h-4 w-4 text-destructive" />
                      {t("weakTopics")}
                    </h3>
                    <ul className="space-y-2">
                      {diagnosis.weakTopics.map((w, i) => (
                        <li key={i} className="rounded-lg border p-3" dir="auto">
                          <p className="font-medium">{w.topic}</p>
                          <p className="text-muted-foreground">{w.evidence}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {diagnosis.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="flex items-center gap-2 font-semibold">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      {t("recommendations")}
                    </h3>
                    <ul className="list-disc space-y-1 ps-5" dir="auto">
                      {diagnosis.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="msg-student">{t("messageToStudent")}</Label>
                    <Textarea id="msg-student" dir="auto" rows={6} value={studentMsg} onChange={(e) => setStudentMsg(e.target.value)} />
                    <Button
                      type="button"
                      size="sm"
                      className="w-full gap-2"
                      disabled={!!sending || !studentMsg.trim()}
                      onClick={() => sendAlert(false)}
                    >
                      {sending === "student" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {t("sendToStudent")}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="msg-parent">{t("messageToParent")}</Label>
                    <Textarea id="msg-parent" dir="auto" rows={6} value={parentMsg} onChange={(e) => setParentMsg(e.target.value)} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={!!sending || !parentMsg.trim() || !active?.hasGuardianEmail}
                      title={!active?.hasGuardianEmail ? t("noGuardianEmail") : undefined}
                      onClick={() => sendAlert(true)}
                    >
                      {sending === "parent" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {t("sendToParent")}
                    </Button>
                    {!active?.hasGuardianEmail && <p className="text-xs text-muted-foreground">{t("noGuardianEmail")}</p>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("aiReviewNote")}</p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
