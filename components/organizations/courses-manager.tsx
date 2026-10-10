"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { BookOpen, Link2, Unlink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState, SectionCard, StatusBadge } from "@/components/shared"

export interface OrgCourseRow {
  id: string
  title: string
  slug: string
  status: string
  instructorId: string
  instructorName: string | null
}

export function CoursesManager({
  orgId,
  courses,
  attachable,
  viewerId,
  canManage,
}: {
  orgId: string
  courses: OrgCourseRow[]
  attachable: OrgCourseRow[]
  viewerId: string
  canManage: boolean
}) {
  const t = useTranslations("organizations")
  const router = useRouter()
  const [pick, setPick] = React.useState("")
  const [busy, setBusy] = React.useState<string | null>(null)

  const run = async (key: string, url: string, init: RequestInit, ok: string) => {
    setBusy(key)
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.code ? t(`errors.${data.code}`) : data.error || t("errors.generic"))
        return
      }
      toast.success(ok)
      setPick("")
      router.refresh()
    } catch {
      toast.error(t("errors.generic"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard icon={Link2} title={t("courses.attach")} description={t("courses.attachHint")}>
        {attachable.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("courses.nothingToAttach")}</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="min-w-0 flex-1" aria-label={t("courses.attach")}>
                <SelectValue placeholder={t("courses.choose")} />
              </SelectTrigger>
              <SelectContent>
                {attachable.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!pick || busy === "attach"}
              onClick={() => run("attach", `/api/organizations/${orgId}/courses`, { method: "POST", body: JSON.stringify({ courseId: pick }) }, t("courses.attached"))}
            >
              {t("courses.attachButton")}
            </Button>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={BookOpen} title={t("courses.title")}>
        {courses.length === 0 ? (
          <EmptyState variant="plain" size="sm" icon={BookOpen} title={t("courses.empty")} />
        ) : (
          <ul className="divide-y">
            {courses.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <Link href={`/courses/${c.slug}`} className="block truncate font-medium hover:underline">{c.title}</Link>
                  <p className="truncate text-xs text-muted-foreground">{c.instructorName}</p>
                </div>
                <StatusBadge status={c.status} />
                {(canManage || c.instructorId === viewerId) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-destructive"
                    disabled={busy === c.id}
                    onClick={() => run(c.id, `/api/organizations/${orgId}/courses/${c.id}`, { method: "DELETE" }, t("courses.detached"))}
                  >
                    <Unlink className="h-4 w-4" aria-hidden="true" />
                    {t("courses.detach")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
