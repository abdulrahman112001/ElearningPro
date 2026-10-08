"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  Ban,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  FileClock,
  GraduationCap,
  Loader2,
  MapPin,
  MoreVertical,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCog,
  Users,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AvatarName, EmptyState, SectionCard, StatCard, StatusBadge } from "@/components/shared"
import { adminUserHref } from "@/components/admin/activity-meta"
import { effectiveApplicationStatus } from "@/lib/instructor-application"
import { cn } from "@/lib/utils"
import {
  ApplicationStatusBadge,
  ReviewActionPanel,
  useApplicationLabels,
  useReviewAction,
  type ApplicationStatus,
  type ReviewAction,
} from "@/components/admin/instructor-review/shared"
import { ApplicationDialog } from "@/components/admin/instructor-review/application-dialog"

import {
  INSTRUCTOR_STATUS_TABS,
  type InstructorStatusTab,
} from "@/components/admin/instructor-review/status-tabs"

interface InstructorRow {
  id: string
  name: string | null
  email: string
  image: string | null
  isBlocked: boolean
  createdAt: string | Date
  instructorProfile: {
    isApproved: boolean
    applicationStatus: ApplicationStatus
    submittedAt: string | Date | null
    specialization: string | null
    governorate: string | null
    yearsOfExperience: number | null
  } | null
  _count: { courses: number }
}

interface InstructorsTableProps {
  instructors: InstructorRow[]
  status: InstructorStatusTab
  counts: Record<InstructorStatusTab, number>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

type RowTarget = Pick<InstructorRow, "id" | "name" | "email">

function rowActions(status: ApplicationStatus): ReviewAction[] {
  if (status === "APPROVED") return ["revoke"]
  if (status === "PENDING") return ["approve", "reject"]
  return ["approve"]
}

export function InstructorsTable({ instructors, status, counts, pagination }: InstructorsTableProps) {
  const t = useTranslations("adminInstructorReview")
  const ta = useTranslations("admin")
  const common = useTranslations("common")
  const a11y = useTranslations("a11y")
  const router = useRouter()
  const pathname = usePathname() || "/admin/instructors"
  const searchParams = useSearchParams()
  const locale = useLocale()
  const labels = useApplicationLabels()
  const { run, pending: reviewPending } = useReviewAction()

  const nf = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-EG"), [locale])
  const df = useMemo(
    () => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-EG", { dateStyle: "medium" }),
    [locale]
  )

  const [search, setSearch] = useState(searchParams?.get("search") || "")
  const [reviewing, setReviewing] = useState<RowTarget | null>(null)
  const [decision, setDecision] = useState<{ action: ReviewAction; row: RowTarget } | null>(null)
  const [blockTarget, setBlockTarget] = useState<{ row: InstructorRow; block: boolean } | null>(null)
  const [blocking, setBlocking] = useState(false)

  const hrefWith = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() || "")
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key)
      else params.set(key, value)
    }
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  // Debounced search: update the URL 350ms after typing stops.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const id = setTimeout(() => {
      router.push(hrefWith({ search: search.trim() || null, page: null }))
    }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const done = () => {
    setDecision(null)
    setReviewing(null)
    router.refresh()
  }

  const confirmDecision = async (reason: string) => {
    if (!decision) return
    const ok = await run(decision.row.id, decision.action, reason)
    if (ok) done()
  }

  const confirmBlock = async () => {
    if (!blockTarget) return
    setBlocking(true)
    try {
      const res = await fetch(`/api/admin/users/${blockTarget.row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: blockTarget.block }),
      })
      if (!res.ok) throw new Error()
      toast.success(blockTarget.block ? t("toast.blocked") : t("toast.unblocked"))
      router.refresh()
    } catch {
      toast.error(t("toast.failed"))
    } finally {
      setBlocking(false)
      setBlockTarget(null)
    }
  }

  const tabLabel: Record<InstructorStatusTab, string> = {
    all: t("tabs.all"),
    pending: t("tabs.pending"),
    draft: t("tabs.draft"),
    approved: t("tabs.approved"),
    rejected: t("tabs.rejected"),
  }

  const formatDate = (v: string | Date | null | undefined) => (v ? df.format(new Date(v)) : null)
  const muted = (text: string) => <span className="text-muted-foreground">{text}</span>

  const renderActions = (row: InstructorRow, appStatus: ApplicationStatus) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={a11y("moreActions")}>
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => setReviewing(row)}>
          <Eye className="me-2 h-4 w-4" aria-hidden="true" />
          {t("reviewApplication")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {rowActions(appStatus).map((action) => (
          <DropdownMenuItem
            key={action}
            onSelect={() => setDecision({ action, row })}
            className={cn(
              action === "approve" && "text-success focus:text-success",
              action !== "approve" && "text-destructive focus:text-destructive"
            )}
          >
            {action === "approve" ? (
              <ShieldCheck className="me-2 h-4 w-4" aria-hidden="true" />
            ) : action === "reject" ? (
              <XCircle className="me-2 h-4 w-4" aria-hidden="true" />
            ) : (
              <ShieldOff className="me-2 h-4 w-4" aria-hidden="true" />
            )}
            {t(action)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={adminUserHref(row)}>
            <UserCog className="me-2 h-4 w-4" aria-hidden="true" />
            {t("viewInUsers")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setBlockTarget({ row, block: !row.isBlocked })}
          className={cn(!row.isBlocked && "text-destructive focus:text-destructive")}
        >
          {row.isBlocked ? (
            <CheckCircle2 className="me-2 h-4 w-4" aria-hidden="true" />
          ) : (
            <Ban className="me-2 h-4 w-4" aria-hidden="true" />
          )}
          {row.isBlocked ? ta("unblock") : ta("block")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const statusCell = (row: InstructorRow, appStatus: ApplicationStatus) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <ApplicationStatusBadge status={appStatus} />
      {row.isBlocked && <StatusBadge status="BLOCKED" label={ta("blocked")} />}
    </div>
  )

  const rows = instructors.map((row) => ({
    row,
    appStatus: effectiveApplicationStatus(row.instructorProfile) as ApplicationStatus,
  }))

  const from = (pagination.page - 1) * pagination.limit + 1
  const to = Math.min(pagination.page * pagination.limit, pagination.total)

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("stats.total")} value={nf.format(counts.all)} icon={Users} />
        <StatCard
          label={t("stats.pending")}
          value={nf.format(counts.pending)}
          icon={Clock}
          tone="warning"
          hint={counts.pending > 0 ? t("stats.pendingHint") : undefined}
        />
        <StatCard
          label={t("stats.approved")}
          value={nf.format(counts.approved)}
          icon={ShieldCheck}
          tone="success"
        />
        <StatCard label={t("stats.draft")} value={nf.format(counts.draft)} icon={FileClock} tone="info" />
      </div>

      {/* Pending nudge when looking at another tab */}
      {status !== "pending" && counts.pending > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("pendingBanner", { count: counts.pending })}
          </p>
          <Button size="sm" variant="outline" className="shrink-0" asChild>
            <Link href={hrefWith({ status: "pending", page: null })}>{t("showPending")}</Link>
          </Button>
        </div>
      )}

      <SectionCard contentClassName="p-0">
        {/* Tabs + search */}
        <div className="space-y-3 border-b p-3 sm:p-4">
          <nav aria-label={t("tabsLabel")} className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <ul className="flex w-max gap-1 rounded-lg bg-muted p-1">
              {INSTRUCTOR_STATUS_TABS.map((tab) => {
                const active = tab === status
                return (
                  <li key={tab}>
                    <Link
                      href={hrefWith({ status: tab, page: null })}
                      aria-current={active ? "page" : undefined}
                      scroll={false}
                      className={cn(
                        "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tabLabel[tab]}
                      <span
                        className={cn(
                          "min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums",
                          tab === "pending" && counts.pending > 0
                            ? "bg-warning/20 text-amber-800 dark:text-amber-300"
                            : active
                              ? "bg-primary/10 text-primary"
                              : "bg-background/60"
                        )}
                      >
                        {nf.format(counts[tab])}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="relative w-full sm:max-w-sm">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder={ta("searchInstructors")}
              aria-label={ta("searchInstructors")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={status === "pending" ? CheckCircle2 : GraduationCap}
            title={status === "pending" && !search ? t("emptyPendingTitle") : t("emptyTitle")}
            description={
              status === "pending" && !search ? t("emptyPendingDescription") : t("emptyDescription")
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="ps-6">{t("columns.instructor")}</TableHead>
                    <TableHead>{t("columns.specialization")}</TableHead>
                    <TableHead>{t("columns.governorate")}</TableHead>
                    <TableHead>{t("columns.experience")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.submittedAt")}</TableHead>
                    <TableHead className="text-center">{t("columns.courses")}</TableHead>
                    <TableHead className="pe-6 text-end">
                      <span className="sr-only">{t("columns.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ row, appStatus }) => {
                    const p = row.instructorProfile
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-[16rem] ps-6">
                          <AvatarName
                            name={row.name || ta("unnamed")}
                            image={row.image}
                            secondary={<span dir="ltr">{row.email}</span>}
                          />
                        </TableCell>
                        <TableCell className="max-w-[12rem] truncate">
                          {p?.specialization || muted("—")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {labels.governorate(p?.governorate) || muted("—")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {p?.yearsOfExperience != null
                            ? t("years", { count: p.yearsOfExperience })
                            : muted("—")}
                        </TableCell>
                        <TableCell>{statusCell(row, appStatus)}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {formatDate(p?.submittedAt) || muted(t("notSubmitted"))}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {nf.format(row._count.courses)}
                        </TableCell>
                        <TableCell className="pe-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant={appStatus === "PENDING" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setReviewing(row)}
                            >
                              {t("reviewApplication")}
                            </Button>
                            {renderActions(row, appStatus)}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile / tablet cards */}
            <ul className="divide-y lg:hidden">
              {rows.map(({ row, appStatus }) => {
                const p = row.instructorProfile
                const governorate = labels.governorate(p?.governorate)
                return (
                  <li key={row.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <AvatarName
                        name={row.name || ta("unnamed")}
                        image={row.image}
                        secondary={<span dir="ltr">{row.email}</span>}
                        className="flex-1"
                      />
                      {renderActions(row, appStatus)}
                    </div>
                    {statusCell(row, appStatus)}
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div className="col-span-2 flex min-w-0 items-center gap-2">
                        <dt>
                          <Briefcase className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <span className="sr-only">{t("columns.specialization")}</span>
                        </dt>
                        <dd className="truncate">{p?.specialization || muted("—")}</dd>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <dt>
                          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <span className="sr-only">{t("columns.governorate")}</span>
                        </dt>
                        <dd className="truncate">{governorate || muted("—")}</dd>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <dt>
                          <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <span className="sr-only">{t("columns.experience")}</span>
                        </dt>
                        <dd className="truncate">
                          {p?.yearsOfExperience != null
                            ? t("years", { count: p.yearsOfExperience })
                            : muted("—")}
                        </dd>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <dt>
                          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <span className="sr-only">{t("columns.submittedAt")}</span>
                        </dt>
                        <dd className="truncate tabular-nums">
                          {formatDate(p?.submittedAt) || muted(t("notSubmitted"))}
                        </dd>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <dt>
                          <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <span className="sr-only">{t("columns.courses")}</span>
                        </dt>
                        <dd className="truncate">{t("coursesCount", { count: row._count.courses })}</dd>
                      </div>
                    </dl>
                    <Button
                      variant={appStatus === "PENDING" ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                      onClick={() => setReviewing(row)}
                    >
                      <Eye className="me-2 h-4 w-4" aria-hidden="true" />
                      {t("reviewApplication")}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-muted-foreground tabular-nums">
              {ta("paginationLabel", {
                start: nf.format(from),
                end: nf.format(to),
                total: nf.format(pagination.total),
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => router.push(hrefWith({ page: String(pagination.page - 1) }))}
              >
                <ChevronLeft className="me-1 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                {common("previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => router.push(hrefWith({ page: String(pagination.page + 1) }))}
              >
                {common("next")}
                <ChevronRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Full application review */}
      <ApplicationDialog
        instructor={reviewing}
        onOpenChange={(open) => !open && setReviewing(null)}
        onDone={done}
      />

      {/* Quick decision from the row menu */}
      <Dialog open={!!decision} onOpenChange={(open) => !open && !reviewPending && setDecision(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>
              {decision?.action === "approve"
                ? t("confirm.approveTitle")
                : decision?.action === "reject"
                  ? t("confirm.rejectTitle")
                  : t("confirm.revokeTitle")}
            </DialogTitle>
            <DialogDescription className="truncate" dir="ltr">
              {decision?.row.email}
            </DialogDescription>
          </DialogHeader>
          {decision && (
            <ReviewActionPanel
              key={`${decision.row.id}-${decision.action}`}
              action={decision.action}
              name={decision.row.name || decision.row.email}
              pending={reviewPending}
              onConfirm={confirmDecision}
              onCancel={() => setDecision(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Block / unblock */}
      <AlertDialog open={!!blockTarget} onOpenChange={(open) => !open && !blocking && setBlockTarget(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockTarget?.block ? ta("confirmBlock") : ta("confirmUnblock")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockTarget &&
                (blockTarget.block
                  ? ta("confirmBlockDescription", { name: blockTarget.row.name || blockTarget.row.email })
                  : ta("confirmUnblockDescription", { name: blockTarget.row.name || blockTarget.row.email }))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={blocking}>{common("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmBlock()
              }}
              disabled={blocking}
              className={cn(blockTarget?.block && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            >
              {blocking && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {common("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
