"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  Award,
  BookOpen,
  Briefcase,
  Check,
  CalendarClock,
  FileText,
  GraduationCap,
  Info,
  Link2,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  User,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState, PageHeader, SectionCard } from "@/components/shared"
import { cn } from "@/lib/utils"
import { GENDERS, QUALIFICATIONS } from "@/lib/instructor-application"
import {
  BIO_MAX,
  BIO_MIN,
  GOVERNORATES,
  GRADE_STAGES,
  MAX_SUBJECTS,
  PHONE_RE,
  URL_RE,
  governorateKey,
  type ApplicationResponse,
  type GradeLevelOption,
} from "./application/constants"
import { TagInput } from "./application/tag-input"
import {
  ApplicationTimeline,
  ApprovedCard,
  PendingStatusCard,
  RejectedAlert,
  type SummaryItem,
} from "./application/status-views"

interface FormState {
  name: string
  phone: string
  whatsapp: string
  gender: string
  governorate: string
  city: string
  headline: string
  specialization: string
  subjects: string[]
  gradeLevelIds: string[]
  yearsOfExperience: string
  currentWorkplace: string
  qualification: string
  university: string
  graduationYear: string
  bio: string
  cvUrl: string
  introVideoUrl: string
  facebook: string
  linkedin: string
  youtube: string
  agreeTerms: boolean
}

type FieldName = keyof FormState
type Errors = Partial<Record<FieldName, string>>

/** Document order, used to scroll to the first invalid field. */
const FIELD_ORDER: FieldName[] = [
  "name",
  "phone",
  "whatsapp",
  "gender",
  "governorate",
  "city",
  "headline",
  "specialization",
  "subjects",
  "gradeLevelIds",
  "yearsOfExperience",
  "currentWorkplace",
  "qualification",
  "university",
  "graduationYear",
  "bio",
  "cvUrl",
  "introVideoUrl",
  "facebook",
  "linkedin",
  "youtube",
  "agreeTerms",
]

const URL_FIELDS = ["cvUrl", "introVideoUrl", "facebook", "linkedin", "youtube"] as const

const fieldId = (f: FieldName) => `ia-${f}`

function emptyForm(): FormState {
  return {
    name: "",
    phone: "",
    whatsapp: "",
    gender: "",
    governorate: "",
    city: "",
    headline: "",
    specialization: "",
    subjects: [],
    gradeLevelIds: [],
    yearsOfExperience: "",
    currentWorkplace: "",
    qualification: "",
    university: "",
    graduationYear: "",
    bio: "",
    cvUrl: "",
    introVideoUrl: "",
    facebook: "",
    linkedin: "",
    youtube: "",
    agreeTerms: false,
  }
}

function formFrom(data: ApplicationResponse): FormState {
  const a = data.application
  const u = data.user
  return {
    name: u.name ?? "",
    phone: a?.phone ?? "",
    whatsapp: a?.whatsapp ?? "",
    gender: a?.gender ?? "",
    governorate: a?.governorate ?? "",
    city: a?.city ?? "",
    headline: u.headline ?? "",
    specialization: a?.specialization ?? "",
    subjects: a?.subjects ?? [],
    gradeLevelIds: a?.gradeLevelIds ?? [],
    yearsOfExperience: a?.yearsOfExperience != null ? String(a.yearsOfExperience) : "",
    currentWorkplace: a?.currentWorkplace ?? "",
    qualification: a?.qualification ?? "",
    university: a?.university ?? "",
    graduationYear: a?.graduationYear != null ? String(a.graduationYear) : "",
    bio: u.bio ?? "",
    cvUrl: a?.cvUrl ?? "",
    introVideoUrl: a?.introVideoUrl ?? "",
    facebook: a?.facebook ?? "",
    linkedin: u.linkedin ?? "",
    youtube: u.youtube ?? "",
    // Consent is asked again on every submission.
    agreeTerms: false,
  }
}

/** Mirrors parseApplication() in lib/instructor-application.ts. */
function validate(f: FormState): Errors {
  const e: Errors = {}
  const req = (k: FieldName, v: string) => {
    if (!v.trim()) e[k] = "required"
  }
  req("name", f.name)
  req("headline", f.headline)
  req("bio", f.bio)
  if (!e.bio && f.bio.trim().length < BIO_MIN) e.bio = "too_short"

  req("phone", f.phone)
  if (!e.phone && !PHONE_RE.test(f.phone.trim())) e.phone = "invalid"
  if (f.whatsapp.trim() && !PHONE_RE.test(f.whatsapp.trim())) e.whatsapp = "invalid"

  req("gender", f.gender)
  req("governorate", f.governorate)
  req("specialization", f.specialization)
  req("qualification", f.qualification)
  req("university", f.university)

  const thisYear = new Date().getFullYear()
  if (f.graduationYear.trim()) {
    const y = Number(f.graduationYear)
    if (!Number.isInteger(y) || y < 1950 || y > thisYear) e.graduationYear = "invalid"
  }

  if (!f.yearsOfExperience.trim()) e.yearsOfExperience = "required"
  else {
    const n = Number(f.yearsOfExperience)
    if (!Number.isInteger(n) || n < 0 || n > 60) e.yearsOfExperience = "invalid"
  }

  for (const k of URL_FIELDS) {
    const v = f[k].trim()
    if (v && !URL_RE.test(v)) e[k] = "invalid_url"
  }

  if (!f.agreeTerms) e.agreeTerms = "required"
  return e
}

function toPayload(f: FormState) {
  const opt = (v: string) => v.trim() || null
  return {
    name: f.name.trim(),
    headline: f.headline.trim(),
    bio: f.bio.trim(),
    phone: f.phone.trim(),
    whatsapp: opt(f.whatsapp),
    gender: f.gender,
    governorate: f.governorate,
    city: opt(f.city),
    specialization: f.specialization.trim(),
    subjects: f.subjects,
    gradeLevelIds: f.gradeLevelIds,
    qualification: f.qualification,
    university: f.university.trim(),
    graduationYear: f.graduationYear.trim() ? Number(f.graduationYear) : null,
    yearsOfExperience: f.yearsOfExperience.trim() === "" ? null : Number(f.yearsOfExperience),
    currentWorkplace: opt(f.currentWorkplace),
    cvUrl: opt(f.cvUrl),
    introVideoUrl: opt(f.introVideoUrl),
    facebook: opt(f.facebook),
    linkedin: opt(f.linkedin),
    youtube: opt(f.youtube),
    agreeTerms: f.agreeTerms,
  }
}

function focusField(field: FieldName) {
  const el = document.getElementById(fieldId(field))
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  ;(el as HTMLElement).focus({ preventScroll: true })
}

/* ------------------------------------------------------------------------ */

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
          >
            {step}
          </span>
          <span className="min-w-0">{title}</span>
        </span>
      }
      description={description ? <span className="block ps-10">{description}</span> : undefined}
    >
      {children}
    </SectionCard>
  )
}

function Field({
  field,
  label,
  required,
  hint,
  error,
  className,
  children,
  extra,
}: {
  field: FieldName
  label: string
  required?: boolean
  hint?: React.ReactNode
  error?: string
  className?: string
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  const t = useTranslations("instructorApplication")
  const id = fieldId(field)
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="leading-snug">
          {label}
          {required ? (
            <span className="ms-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          ) : (
            <span className="ms-1.5 text-xs font-normal text-muted-foreground">({t("optional")})</span>
          )}
        </Label>
        {extra}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------------ */

export function InstructorApplicationForm() {
  const t = useTranslations("instructorApplication")
  const locale = useLocale()
  const router = useRouter()
  const { update } = useSession()
  const dir = locale === "ar" ? "rtl" : "ltr"

  const [data, setData] = React.useState<ApplicationResponse | null>(null)
  const [loadError, setLoadError] = React.useState(false)
  const [grades, setGrades] = React.useState<GradeLevelOption[]>([])
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [errors, setErrors] = React.useState<Errors>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [continuing, setContinuing] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [locale]
  )
  const fmtDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : null)

  const load = React.useCallback(async () => {
    setLoadError(false)
    setData(null)
    try {
      const [appRes, gradesRes] = await Promise.all([
        fetch("/api/instructor/application", { cache: "no-store" }),
        fetch("/api/grade-levels").catch(() => null),
      ])
      if (gradesRes?.ok) {
        const g = await gradesRes.json().catch(() => [])
        if (Array.isArray(g)) setGrades(g)
      }
      if (!appRes.ok) throw new Error(String(appRes.status))
      const json: ApplicationResponse = await appRes.json()
      setData(json)
      setForm(formFrom(json))
      setErrors({})
    } catch {
      setLoadError(true)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const set = <K extends FieldName>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const errorText = (field: FieldName): string | undefined => {
    const code = errors[field]
    if (!code) return undefined
    if (code === "required") return field === "agreeTerms" ? t("errors.termsRequired") : t("errors.required")
    if (code === "too_short") return t("errors.bioTooShort", { min: BIO_MIN })
    if (code === "invalid_url") return t("errors.invalidUrl")
    if (field === "phone" || field === "whatsapp") return t("errors.phoneInvalid")
    if (field === "yearsOfExperience") return t("errors.yearsInvalid")
    if (field === "graduationYear") return t("errors.graduationYearInvalid", { max: new Date().getFullYear() })
    return t("errors.invalid")
  }

  const aria = (field: FieldName, hasHint = false) => ({
    id: fieldId(field),
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field]
      ? `${fieldId(field)}-error`
      : hasHint
        ? `${fieldId(field)}-hint`
        : undefined,
  })

  const showErrors = (next: Errors) => {
    setErrors(next)
    const first = FIELD_ORDER.find((f) => next[f])
    if (first) {
      toast.error(t("errors.fixFields"))
      // Wait for the error messages to render before scrolling.
      requestAnimationFrame(() => focusField(first))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const clientErrors = validate(form)
    if (Object.keys(clientErrors).length) {
      showErrors(clientErrors)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/instructor/application", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 400 && json?.code === "validation" && Array.isArray(json.fields)) {
        const next: Errors = {}
        for (const f of json.fields as { field: string; code: string }[]) {
          if (f.field in form && !next[f.field as FieldName]) next[f.field as FieldName] = f.code
        }
        showErrors(next)
        return
      }
      if (res.status === 409 && json?.code === "already_approved") {
        setData((d) => (d ? { ...d, status: "APPROVED" } : d))
        setEditing(false)
        window.scrollTo({ top: 0, behavior: "smooth" })
        return
      }
      if (!res.ok) throw new Error()
      const next = json as ApplicationResponse
      setData(next)
      setForm(formFrom(next))
      setErrors({})
      setEditing(false)
      toast.success(t("submitSuccess"))
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      toast.error(t("submitFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  const goToDashboard = async () => {
    setContinuing(true)
    try {
      await update()
    } catch {
      // The layout re-reads approval on every request, so navigating still works.
    }
    router.replace("/instructor")
    router.refresh()
  }

  /* ------------------------------ render ------------------------------ */

  const header = (
    <PageHeader icon={GraduationCap} title={t("title")} description={t("subtitle")} />
  )

  if (loadError) {
    return (
      <div>
        {header}
        <EmptyState
          icon={Info}
          title={t("loadFailed")}
          description={t("loadFailedHint")}
          action={
            <Button variant="outline" onClick={load} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("retry")}
            </Button>
          }
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div aria-busy="true">
        {header}
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    )
  }

  const status = data.status
  const showForm = status === "DRAFT" || status === "REJECTED" || (status === "PENDING" && editing)

  const gradeName = (g: GradeLevelOption) => (locale === "ar" ? g.nameAr || g.nameEn : g.nameEn || g.nameAr)
  const govName = (g: string) =>
    (GOVERNORATES as readonly string[]).includes(g) ? t(`governorates.${governorateKey(g)}`) : g
  const qualName = (q: string) =>
    (QUALIFICATIONS as readonly string[]).includes(q) ? t(`qualifications.${q}`) : q

  const gradesByStage = GRADE_STAGES.map((stage) => ({
    stage,
    items: grades.filter((g) => (g.stage && (GRADE_STAGES as readonly string[]).includes(g.stage) ? g.stage : "other") === stage),
  })).filter((s) => s.items.length > 0)

  const summary: SummaryItem[] = []
  if (data.application) {
    const a = data.application
    if (data.user.name) summary.push({ icon: User, label: t("fields.name"), value: data.user.name })
    if (a.specialization) summary.push({ icon: BookOpen, label: t("fields.specialization"), value: a.specialization })
    if (a.governorate)
      summary.push({
        icon: MapPin,
        label: t("fields.governorate"),
        value: [govName(a.governorate), a.city].filter(Boolean).join(t("listSeparator")),
      })
    if (a.qualification)
      summary.push({
        icon: Award,
        label: t("fields.qualification"),
        value: [qualName(a.qualification), a.university].filter(Boolean).join(t("listSeparator")),
      })
    if (a.yearsOfExperience != null)
      summary.push({
        icon: Briefcase,
        label: t("fields.yearsOfExperience"),
        value: t("yearsValue", { count: a.yearsOfExperience }),
      })
    if (a.phone)
      summary.push({ icon: Phone, label: t("fields.phone"), value: <span dir="ltr">{a.phone}</span> })
    if (a.gradeLevelIds.length && grades.length) {
      const names = grades.filter((g) => a.gradeLevelIds.includes(g.id)).map(gradeName)
      if (names.length)
        summary.push({ icon: GraduationCap, label: t("fields.gradeLevels"), value: names.join(t("listSeparator")) })
    }
    if (a.subjects.length)
      summary.push({ icon: BookOpen, label: t("fields.subjects"), value: a.subjects.join(t("listSeparator")) })
  }

  const bioLen = form.bio.trim().length
  const yearMax = new Date().getFullYear()

  return (
    <div className="space-y-6">
      {header}

      {status === "APPROVED" && <ApprovedCard onContinue={goToDashboard} busy={continuing} />}

      {status === "PENDING" && (
        <PendingStatusCard
          submittedAt={fmtDate(data.application?.submittedAt)}
          summary={summary}
          editing={editing}
          onEdit={() => {
            setEditing(true)
            requestAnimationFrame(() =>
              formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            )
          }}
        />
      )}

      {status === "REJECTED" && (
        <RejectedAlert
          reason={data.application?.rejectionReason ?? null}
          reviewedAt={fmtDate(data.application?.reviewedAt)}
        />
      )}

      {status === "DRAFT" && (
        <section className="overflow-hidden rounded-lg border bg-card shadow-soft">
          <div className="bg-gradient-to-br from-primary/10 via-transparent to-transparent p-4 sm:p-6">
            <h2 className="type-h3">{t("intro.title")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("intro.description")}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, title: t("intro.whyTitle"), text: t("intro.whyText") },
                { icon: CalendarClock, title: t("intro.reviewTitle"), text: t("intro.reviewText") },
                { icon: Link2, title: t("intro.linksTitle"), text: t("intro.linksText") },
              ].map((p) => (
                <li key={p.title} className="flex items-start gap-3 rounded-lg border bg-background/70 p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <p.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.title}</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t p-4 sm:p-6">
            <ApplicationTimeline states={["done", "current", "upcoming", "upcoming"]} />
          </div>
        </section>
      )}

      {showForm && (
        <form ref={formRef} onSubmit={submit} noValidate className="scroll-mt-24 space-y-6">
          {status === "PENDING" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/20 bg-info/5 p-3 text-sm">
              <p className="flex min-w-0 items-start gap-2 text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                {t("editingNotice")}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditing(false)
                  setForm(formFrom(data))
                  setErrors({})
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {t("cancelEdit")}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            <span className="text-destructive" aria-hidden="true">
              *
            </span>{" "}
            {t("requiredNote")}
          </p>

          {/* 1. Personal info */}
          <FormSection step={1} title={t("sections.personal")} description={t("sections.personalHint")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field field="name" label={t("fields.name")} required error={errorText("name")}>
                <Input
                  {...aria("name")}
                  value={form.name}
                  maxLength={100}
                  autoComplete="name"
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={t("placeholders.name")}
                />
              </Field>
              <Field
                field="phone"
                label={t("fields.phone")}
                required
                error={errorText("phone")}
                hint={t("hints.phone")}
              >
                <Input
                  {...aria("phone", true)}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  maxLength={20}
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="text-start"
                />
              </Field>
              <Field
                field="whatsapp"
                label={t("fields.whatsapp")}
                error={errorText("whatsapp")}
                extra={
                  form.phone.trim() && form.whatsapp !== form.phone ? (
                    <button
                      type="button"
                      onClick={() => set("whatsapp", form.phone)}
                      className="shrink-0 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t("sameAsPhone")}
                    </button>
                  ) : null
                }
              >
                <Input
                  {...aria("whatsapp")}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  maxLength={20}
                  value={form.whatsapp}
                  onChange={(e) => set("whatsapp", e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="text-start"
                />
              </Field>
              <Field field="gender" label={t("fields.gender")} required error={errorText("gender")}>
                <Select dir={dir} value={form.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger {...aria("gender")}>
                    <SelectValue placeholder={t("placeholders.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {t(`genders.${g}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field field="governorate" label={t("fields.governorate")} required error={errorText("governorate")}>
                <Select dir={dir} value={form.governorate} onValueChange={(v) => set("governorate", v)}>
                  <SelectTrigger {...aria("governorate")}>
                    <SelectValue placeholder={t("placeholders.governorate")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {form.governorate && !(GOVERNORATES as readonly string[]).includes(form.governorate) && (
                      <SelectItem value={form.governorate}>{form.governorate}</SelectItem>
                    )}
                    {GOVERNORATES.map((g) => (
                      <SelectItem key={g} value={g}>
                        {t(`governorates.${governorateKey(g)}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field field="city" label={t("fields.city")} error={errorText("city")}>
                <Input
                  {...aria("city")}
                  value={form.city}
                  maxLength={60}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder={t("placeholders.city")}
                />
              </Field>
            </div>
          </FormSection>

          {/* 2. Teaching */}
          <FormSection step={2} title={t("sections.teaching")} description={t("sections.teachingHint")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                field="headline"
                label={t("fields.headline")}
                required
                error={errorText("headline")}
                hint={t("hints.headline")}
                className="md:col-span-2"
              >
                <Input
                  {...aria("headline", true)}
                  value={form.headline}
                  maxLength={120}
                  onChange={(e) => set("headline", e.target.value)}
                  placeholder={t("placeholders.headline")}
                />
              </Field>
              <Field
                field="specialization"
                label={t("fields.specialization")}
                required
                error={errorText("specialization")}
              >
                <Input
                  {...aria("specialization")}
                  value={form.specialization}
                  maxLength={80}
                  onChange={(e) => set("specialization", e.target.value)}
                  placeholder={t("placeholders.specialization")}
                />
              </Field>
              <Field
                field="yearsOfExperience"
                label={t("fields.yearsOfExperience")}
                required
                error={errorText("yearsOfExperience")}
              >
                <Input
                  {...aria("yearsOfExperience")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={60}
                  step={1}
                  value={form.yearsOfExperience}
                  onChange={(e) => set("yearsOfExperience", e.target.value)}
                  placeholder="0"
                  className="tabular-nums"
                />
              </Field>
              <Field
                field="subjects"
                label={t("fields.subjects")}
                error={errorText("subjects")}
                hint={t("hints.subjects", { max: MAX_SUBJECTS, count: form.subjects.length })}
                className="md:col-span-2"
              >
                <TagInput
                  id={fieldId("subjects")}
                  value={form.subjects}
                  onChange={(v) => set("subjects", v)}
                  max={MAX_SUBJECTS}
                  placeholder={t("placeholders.subjects")}
                  removeLabel={(tag) => t("removeSubject", { subject: tag })}
                  describedBy={`${fieldId("subjects")}-hint`}
                />
              </Field>
              <Field
                field="currentWorkplace"
                label={t("fields.currentWorkplace")}
                error={errorText("currentWorkplace")}
                className="md:col-span-2"
              >
                <Input
                  {...aria("currentWorkplace")}
                  value={form.currentWorkplace}
                  maxLength={120}
                  onChange={(e) => set("currentWorkplace", e.target.value)}
                  placeholder={t("placeholders.currentWorkplace")}
                />
              </Field>

              {gradesByStage.length > 0 && (
                <fieldset className="min-w-0 space-y-3 md:col-span-2" id={fieldId("gradeLevelIds")} tabIndex={-1}>
                  <legend className="text-sm font-medium leading-snug">
                    {t("fields.gradeLevels")}
                    <span className="ms-1.5 text-xs font-normal text-muted-foreground">({t("optional")})</span>
                  </legend>
                  <p className="text-xs text-muted-foreground">{t("hints.gradeLevels")}</p>
                  <div className="space-y-3">
                    {gradesByStage.map(({ stage, items }) => (
                      <div key={stage} className="space-y-2">
                        {gradesByStage.length > 1 && (
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t(`stages.${stage}`)}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {items.map((g) => {
                            const selected = form.gradeLevelIds.includes(g.id)
                            return (
                              <button
                                key={g.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() =>
                                  set(
                                    "gradeLevelIds",
                                    selected
                                      ? form.gradeLevelIds.filter((id) => id !== g.id)
                                      : [...form.gradeLevelIds, g.id]
                                  )
                                }
                                className={cn(
                                  "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-input bg-background hover:border-primary/40 hover:bg-primary/5"
                                )}
                              >
                                {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                                <span className="truncate">{gradeName(g)}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          </FormSection>

          {/* 3. Qualifications */}
          <FormSection step={3} title={t("sections.qualifications")} description={t("sections.qualificationsHint")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                field="qualification"
                label={t("fields.qualification")}
                required
                error={errorText("qualification")}
              >
                <Select dir={dir} value={form.qualification} onValueChange={(v) => set("qualification", v)}>
                  <SelectTrigger {...aria("qualification")}>
                    <SelectValue placeholder={t("placeholders.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALIFICATIONS.map((q) => (
                      <SelectItem key={q} value={q}>
                        {t(`qualifications.${q}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field field="university" label={t("fields.university")} required error={errorText("university")}>
                <Input
                  {...aria("university")}
                  value={form.university}
                  maxLength={120}
                  onChange={(e) => set("university", e.target.value)}
                  placeholder={t("placeholders.university")}
                />
              </Field>
              <Field field="graduationYear" label={t("fields.graduationYear")} error={errorText("graduationYear")}>
                <Input
                  {...aria("graduationYear")}
                  type="number"
                  inputMode="numeric"
                  min={1950}
                  max={yearMax}
                  step={1}
                  value={form.graduationYear}
                  onChange={(e) => set("graduationYear", e.target.value)}
                  placeholder={String(yearMax - 5)}
                  className="tabular-nums"
                />
              </Field>
            </div>
          </FormSection>

          {/* 4. About & links */}
          <FormSection step={4} title={t("sections.about")} description={t("sections.aboutHint")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                field="bio"
                label={t("fields.bio")}
                required
                error={errorText("bio")}
                hint={t("hints.bio", { min: BIO_MIN })}
                className="md:col-span-2"
                extra={
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      bioLen >= BIO_MIN ? "text-success" : "text-muted-foreground"
                    )}
                    aria-live="polite"
                  >
                    {bioLen < BIO_MIN
                      ? t("bioCounterRemaining", { count: BIO_MIN - bioLen })
                      : t("bioCounter", { count: form.bio.length, max: BIO_MAX })}
                  </span>
                }
              >
                <Textarea
                  {...aria("bio", true)}
                  value={form.bio}
                  maxLength={BIO_MAX}
                  rows={6}
                  onChange={(e) => set("bio", e.target.value)}
                  placeholder={t("placeholders.bio")}
                />
              </Field>
              {URL_FIELDS.map((k) => (
                <Field
                  key={k}
                  field={k}
                  label={t(`fields.${k}`)}
                  error={errorText(k)}
                  hint={k === "cvUrl" ? t("hints.cvUrl") : k === "introVideoUrl" ? t("hints.introVideoUrl") : undefined}
                  className={k === "cvUrl" || k === "introVideoUrl" ? "md:col-span-1" : undefined}
                >
                  <div className="relative">
                    {k === "cvUrl" ? (
                      <FileText className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Link2 className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    )}
                    <Input
                      {...aria(k, k === "cvUrl" || k === "introVideoUrl")}
                      type="url"
                      inputMode="url"
                      dir="ltr"
                      maxLength={500}
                      value={form[k]}
                      onChange={(e) => set(k, e.target.value)}
                      placeholder={t(`placeholders.${k}`)}
                      className="ps-9 text-start"
                    />
                  </div>
                </Field>
              ))}
            </div>
          </FormSection>

          {/* 5. Terms */}
          <FormSection step={5} title={t("sections.terms")}>
            <div className="space-y-2">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 sm:p-4",
                  errors.agreeTerms ? "border-destructive/50 bg-destructive/5" : "bg-muted/30"
                )}
              >
                <Checkbox
                  id={fieldId("agreeTerms")}
                  checked={form.agreeTerms}
                  onCheckedChange={(v) => set("agreeTerms", v === true)}
                  aria-invalid={errors.agreeTerms ? true : undefined}
                  aria-describedby={errors.agreeTerms ? `${fieldId("agreeTerms")}-error` : undefined}
                  className="mt-0.5"
                />
                <Label htmlFor={fieldId("agreeTerms")} className="text-sm font-normal leading-relaxed">
                  {t.rich("termsLabel", {
                    link: (chunks) => (
                      <Link
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                  <span className="ms-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
              </div>
              {errors.agreeTerms && (
                <p id={`${fieldId("agreeTerms")}-error`} className="text-xs font-medium text-destructive">
                  {errorText("agreeTerms")}
                </p>
              )}
            </div>
          </FormSection>

          <div className="sticky bottom-4 z-10 flex justify-end">
            <div className="w-full rounded-lg bg-background/80 p-1 shadow-elevated backdrop-blur sm:w-auto sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
              <Button type="submit" size="lg" disabled={submitting} className="w-full gap-2 sm:w-auto">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                )}
                {submitting
                  ? t("submitting")
                  : status === "DRAFT"
                    ? t("submit")
                    : t("resubmit")}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
