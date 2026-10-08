"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  History,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldOff,
  User,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarName, EmptyState } from "@/components/shared"
import { formatDateTime } from "@/components/admin/activity-meta"
import { cn } from "@/lib/utils"
import {
  ApplicationStatusBadge,
  ReviewActionPanel,
  useApplicationLabels,
  useReviewAction,
  type ApplicationStatus,
  type ReviewAction,
} from "./shared"

interface ApplicationDetails {
  status: ApplicationStatus
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
    headline: string | null
    bio: string | null
    linkedin: string | null
    youtube: string | null
    createdAt: string
  }
  application: {
    isApproved: boolean
    applicationStatus: ApplicationStatus
    submittedAt: string | null
    reviewedAt: string | null
    rejectionReason: string | null
    phone: string | null
    whatsapp: string | null
    gender: string | null
    governorate: string | null
    city: string | null
    specialization: string | null
    subjects: string[]
    gradeLevelIds: string[]
    qualification: string | null
    university: string | null
    graduationYear: number | null
    yearsOfExperience: number | null
    currentWorkplace: string | null
    cvUrl: string | null
    introVideoUrl: string | null
    facebook: string | null
    agreedToTermsAt: string | null
  } | null
  gradeLevels: { id: string; nameAr: string; nameEn: string }[]
}

export interface ApplicationDialogProps {
  /** Instructor to review; null closes the dialog */
  instructor: { id: string; name: string | null; email: string } | null
  onOpenChange: (open: boolean) => void
  /** Called after a successful decision (parent refreshes the list) */
  onDone: () => void
}

/** Actions available for a given effective status. */
export function availableActions(status: ApplicationStatus): ReviewAction[] {
  if (status === "APPROVED") return ["revoke"]
  if (status === "PENDING") return ["reject", "approve"]
  return ["approve"]
}

const isHttpUrl = (v: string | null | undefined): v is string => !!v && /^https?:\/\//i.test(v)

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`
}

/** wa.me needs the international number without "+"; Egyptian local numbers start with 0. */
function whatsappHref(phone: string) {
  let digits = phone.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  else if (digits.startsWith("0")) digits = `20${digits.slice(1)}`
  return `https://wa.me/${digits}`
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-card p-4 sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={cn("min-w-0 space-y-1", full && "sm:col-span-2")}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{children}</dd>
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function DetailsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-lg border p-5">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ApplicationDialog({ instructor, onOpenChange, onDone }: ApplicationDialogProps) {
  const t = useTranslations("adminInstructorReview")
  const locale = useLocale()
  const labels = useApplicationLabels()
  const { run, pending } = useReviewAction()

  const [data, setData] = useState<ApplicationDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [action, setAction] = useState<ReviewAction | null>(null)

  const id = instructor?.id ?? null

  const load = useCallback(async (instructorId: string, signal?: AbortSignal) => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}`, { signal })
      if (!res.ok) throw new Error(String(res.status))
      setData((await res.json()) as ApplicationDetails)
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") setFailed(true)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    setData(null)
    setAction(null)
    if (!id) return
    const controller = new AbortController()
    load(id, controller.signal)
    return () => controller.abort()
  }, [id, load])

  const confirm = async (reason: string) => {
    if (!id || !action) return
    const ok = await run(id, action, reason)
    if (ok) {
      setAction(null)
      onDone()
    }
  }

  const empty = t("notProvided")
  const show = (v: string | number | null | undefined) =>
    v === null || v === undefined || v === "" ? (
      <span className="font-normal text-muted-foreground">{empty}</span>
    ) : (
      v
    )
  const date = (v: string | null | undefined) =>
    v ? (
      <time dateTime={v} className="tabular-nums">
        {formatDateTime(v, locale)}
      </time>
    ) : (
      show(null)
    )

  const app = data?.application ?? null
  const status: ApplicationStatus = data?.status ?? "DRAFT"
  const displayName = data?.user.name || instructor?.name || instructor?.email || ""
  const hasSubmitted = !!app && (status !== "DRAFT" || !!app.submittedAt)

  const links = data
    ? (
        [
          { key: "cv", href: app?.cvUrl, icon: FileText },
          { key: "introVideo", href: app?.introVideoUrl, icon: ExternalLink },
          { key: "facebook", href: app?.facebook, icon: ExternalLink },
          { key: "linkedin", href: data.user.linkedin, icon: ExternalLink },
          { key: "youtube", href: data.user.youtube, icon: ExternalLink },
        ] as const
      ).filter((l) => isHttpUrl(l.href))
    : []

  return (
    <Dialog open={!!instructor} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-lg p-0">
        {/* Header */}
        <div className="border-b px-4 pb-4 pt-5 pe-12 sm:px-6">
          <DialogTitle className="sr-only">{t("dialog.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("dialog.description")}</DialogDescription>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("dialog.title")}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AvatarName
              name={data?.user.name ?? instructor?.name}
              image={data?.user.image}
              secondary={<span dir="ltr">{data?.user.email ?? instructor?.email}</span>}
              size="lg"
              className="min-w-0 flex-1"
            />
            {data && <ApplicationStatusBadge status={status} />}
          </div>
          {data?.user.headline && (
            <p className="mt-3 text-sm text-muted-foreground">{data.user.headline}</p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
          {loading && !data ? (
            <>
              <span className="sr-only" role="status">
                {t("dialog.loading")}
              </span>
              <DetailsSkeleton />
            </>
          ) : failed ? (
            <EmptyState
              icon={AlertCircle}
              title={t("dialog.loadError")}
              action={
                <Button variant="outline" size="sm" onClick={() => id && load(id)}>
                  <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
                  {t("dialog.retry")}
                </Button>
              }
            />
          ) : data ? (
            <div className="space-y-4">
              {status === "REJECTED" && app?.rejectionReason && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
                  <p className="mb-1 flex items-center gap-2 font-semibold text-destructive">
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    {t("fields.rejectionReason")}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-foreground/90">
                    {app.rejectionReason}
                  </p>
                </div>
              )}

              {!hasSubmitted ? (
                <EmptyState
                  icon={FileText}
                  title={t("draftTitle")}
                  description={t("draftDescription")}
                />
              ) : (
                app && (
                  <>
                    <Section icon={User} title={t("sections.personal")}>
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <Field label={t("fields.phone")}>
                          {app.phone ? (
                            <a
                              href={telHref(app.phone)}
                              dir="ltr"
                              className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                            >
                              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                              {app.phone}
                            </a>
                          ) : (
                            show(null)
                          )}
                        </Field>
                        <Field label={t("fields.whatsapp")}>
                          {app.whatsapp ? (
                            <a
                              href={whatsappHref(app.whatsapp)}
                              target="_blank"
                              rel="noopener noreferrer"
                              dir="ltr"
                              className="inline-flex items-center gap-1.5 text-success underline-offset-4 hover:underline"
                              title={t("openWhatsapp")}
                            >
                              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              {app.whatsapp}
                            </a>
                          ) : (
                            show(null)
                          )}
                        </Field>
                        <Field label={t("fields.gender")}>{show(labels.gender(app.gender))}</Field>
                        <Field label={t("fields.governorate")}>
                          {show(
                            [labels.governorate(app.governorate), app.city]
                              .filter(Boolean)
                              .join(locale === "ar" ? "، " : ", ")
                          )}
                        </Field>
                      </dl>
                    </Section>

                    <Section icon={BookOpen} title={t("sections.teaching")}>
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <Field label={t("fields.specialization")}>{show(app.specialization)}</Field>
                        <Field label={t("fields.yearsOfExperience")}>
                          {app.yearsOfExperience === null
                            ? show(null)
                            : t("years", { count: app.yearsOfExperience })}
                        </Field>
                        <Field label={t("fields.currentWorkplace")} full>
                          {show(app.currentWorkplace)}
                        </Field>
                        <Field label={t("fields.subjects")} full>
                          {app.subjects.length ? <Chips items={app.subjects} /> : show(null)}
                        </Field>
                        <Field label={t("fields.gradeLevels")} full>
                          {data.gradeLevels.length ? (
                            <Chips
                              items={data.gradeLevels.map((g) =>
                                locale === "ar" ? g.nameAr : g.nameEn || g.nameAr
                              )}
                            />
                          ) : (
                            show(null)
                          )}
                        </Field>
                      </dl>
                    </Section>

                    <Section icon={GraduationCap} title={t("sections.qualifications")}>
                      <dl className="grid gap-4 sm:grid-cols-3">
                        <Field label={t("fields.qualification")}>
                          {show(labels.qualification(app.qualification))}
                        </Field>
                        <Field label={t("fields.university")}>{show(app.university)}</Field>
                        <Field label={t("fields.graduationYear")}>
                          <span className="tabular-nums">{show(app.graduationYear)}</span>
                        </Field>
                      </dl>
                    </Section>

                    <Section icon={Briefcase} title={t("sections.about")}>
                      <dl className="space-y-4">
                        <Field label={t("fields.bio")}>
                          {data.user.bio ? (
                            <p className="whitespace-pre-wrap font-normal leading-relaxed">
                              {data.user.bio}
                            </p>
                          ) : (
                            show(null)
                          )}
                        </Field>
                        <Field label={t("sections.links")}>
                          {links.length ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {links.map(({ key, href, icon: Icon }) => (
                                <Button key={key} variant="outline" size="sm" asChild>
                                  <a href={href!} target="_blank" rel="noopener noreferrer">
                                    <Icon className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                    {t(`fields.${key}`)}
                                  </a>
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <span className="font-normal text-muted-foreground">{t("noLinks")}</span>
                          )}
                        </Field>
                      </dl>
                    </Section>
                  </>
                )
              )}

              <Section icon={History} title={t("sections.meta")}>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("fields.registeredAt")}>{date(data.user.createdAt)}</Field>
                  <Field label={t("fields.submittedAt")}>{date(app?.submittedAt)}</Field>
                  <Field label={t("fields.reviewedAt")}>{date(app?.reviewedAt)}</Field>
                  <Field label={t("fields.agreedToTermsAt")}>{date(app?.agreedToTermsAt)}</Field>
                  {status !== "REJECTED" && app?.rejectionReason && (
                    <Field label={t("fields.rejectionReason")} full>
                      <p className="whitespace-pre-wrap font-normal">{app.rejectionReason}</p>
                    </Field>
                  )}
                </dl>
              </Section>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {data && !failed && (
          <div className="border-t bg-background px-4 py-3 sm:px-6 sm:py-4">
            {action ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  {action === "approve"
                    ? t("confirm.approveTitle")
                    : action === "reject"
                      ? t("confirm.rejectTitle")
                      : t("confirm.revokeTitle")}
                </p>
                <ReviewActionPanel
                  key={action}
                  action={action}
                  name={displayName}
                  pending={pending}
                  onConfirm={confirm}
                  onCancel={() => setAction(null)}
                />
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  {t("dialog.close")}
                </Button>
                {availableActions(status).map((a) =>
                  a === "approve" ? (
                    <Button
                      key={a}
                      onClick={() => setAction(a)}
                      className="bg-success text-success-foreground hover:bg-success/90"
                    >
                      <CheckCircle2 className="me-2 h-4 w-4" aria-hidden="true" />
                      {t("approve")}
                    </Button>
                  ) : a === "reject" ? (
                    <Button
                      key={a}
                      variant="outline"
                      onClick={() => setAction(a)}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XCircle className="me-2 h-4 w-4" aria-hidden="true" />
                      {t("reject")}
                    </Button>
                  ) : (
                    <Button key={a} variant="destructive" onClick={() => setAction(a)}>
                      <ShieldOff className="me-2 h-4 w-4" aria-hidden="true" />
                      {t("revoke")}
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
        )}
        {loading && data && (
          <Loader2 className="absolute end-12 top-5 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
      </DialogContent>
    </Dialog>
  )
}
