"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Library, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { EmptyState, ListSkeleton, PageHeader } from "@/components/shared"
import {
  BankFilters,
  EMPTY_BANK_FILTER,
  bankQueryString,
  useGradeLevels,
  type BankFilterValue,
  type GradeLevel,
} from "./bank-filters"
import { BankItemSummary, type BankItem } from "./bank-item-summary"
import { QuestionFields } from "./question-fields"
import {
  DIFFICULTIES,
  blankQuestion,
  questionPayload,
  questionProblem,
  toEditorQuestion,
  type EditorQuestion,
} from "./types"

const PAGE_SIZE = 20
const NONE = "__none"

interface Classification {
  subject: string
  gradeLevelId: string
  tags: string
  difficulty: string
}

export function QuestionBankManager() {
  const t = useTranslations("exams")
  const grades = useGradeLevels()
  const [filter, setFilter] = React.useState<BankFilterValue>(EMPTY_BANK_FILTER)
  const [page, setPage] = React.useState(1)
  const [data, setData] = React.useState<{ items: BankItem[]; total: number; subjects: string[]; tags: string[] } | null>(null)
  const [error, setError] = React.useState(false)
  const [editing, setEditing] = React.useState<BankItem | "new" | null>(null)
  const [deleting, setDeleting] = React.useState<BankItem | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    fetch(`/api/instructor/question-bank?${bankQueryString(filter, { page, pageSize: PAGE_SIZE })}`)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        const json = await r.json()
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setData({ items: [], total: 0, subjects: [], tags: [] })
        }
      })
    return () => {
      cancelled = true
    }
  }, [filter, page, reloadKey])

  const onFilter = React.useCallback((f: BankFilterValue) => {
    setFilter(f)
    setPage(1)
  }, [])

  const remove = async () => {
    if (!deleting) return
    const res = await fetch(`/api/instructor/question-bank/${deleting.id}`, { method: "DELETE" })
    setDeleting(null)
    if (!res.ok) {
      toast.error(t("bank.deleteFailed"))
      return
    }
    toast.success(t("bank.deleted"))
    setReloadKey((k) => k + 1)
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Library}
        title={t("bank.title")}
        description={t("bank.subtitle")}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="me-2 h-4 w-4" />
            {t("bank.newQuestion")}
          </Button>
        }
      />

      <BankFilters
        value={filter}
        onChange={onFilter}
        subjects={data?.subjects ?? []}
        tags={data?.tags ?? []}
        grades={grades}
      />

      {data === null ? (
        <ListSkeleton rows={5} withAction />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Library}
          title={error ? t("bank.loadFailed") : t("bank.emptyTitle")}
          description={error ? undefined : t("bank.emptyHint")}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("bank.total", { count: data.total })}</p>
          {data.items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-soft">
              <div className="min-w-0 flex-1">
                <BankItemSummary item={item} grades={grades} />
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(item)} aria-label={t("bank.edit")}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleting(item)} aria-label={t("bank.delete")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t("bank.prev")}
              </Button>
              <span className="text-sm text-muted-foreground">{t("bank.pageOf", { page, pages })}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                {t("bank.next")}
              </Button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <BankItemDialog
          item={editing === "new" ? null : editing}
          grades={grades}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setReloadKey((k) => k + 1)
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bank.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("bank.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>{t("bank.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function BankItemDialog({
  item,
  grades,
  onClose,
  onSaved,
}: {
  item: BankItem | null
  grades: GradeLevel[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations("exams")
  const locale = useLocale()
  const [question, setQuestion] = React.useState<EditorQuestion>(() =>
    item ? toEditorQuestion(item, true) : blankQuestion()
  )
  const [meta, setMeta] = React.useState<Classification>({
    subject: item?.subject ?? "",
    gradeLevelId: item?.gradeLevelId ?? "",
    tags: item?.tags.join(", ") ?? "",
    difficulty: item?.difficulty ?? "",
  })
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    const problem = questionProblem(question)
    if (problem) {
      toast.error(t(problem))
      return
    }
    setSaving(true)
    try {
      const res = await fetch(item ? `/api/instructor/question-bank/${item.id}` : "/api/instructor/question-bank", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...questionPayload(question),
          subject: meta.subject.trim() || null,
          gradeLevelId: meta.gradeLevelId || null,
          difficulty: meta.difficulty || null,
          tags: meta.tags
            .split(/[,،]/)
            .map((s) => s.trim().replace(/^#/, ""))
            .filter(Boolean),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      toast.success(t("bank.saved"))
      onSaved()
    } catch (e: any) {
      toast.error(e?.message || t("bank.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{item ? t("bank.editTitle") : t("bank.newQuestion")}</DialogTitle>
        </DialogHeader>
        <div className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("bank.subject")}</Label>
              <Input value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("bank.gradeLevel")}</Label>
              <Select
                value={meta.gradeLevelId || NONE}
                onValueChange={(v) => setMeta({ ...meta, gradeLevelId: v === NONE ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("bank.none")}</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {locale === "ar" ? g.nameAr : g.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("bank.difficultyLabel")}</Label>
              <Select
                value={meta.difficulty || NONE}
                onValueChange={(v) => setMeta({ ...meta, difficulty: v === NONE ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("bank.none")}</SelectItem>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {t(`difficulty.${d}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("bank.tags")}</Label>
              <Input
                value={meta.tags}
                onChange={(e) => setMeta({ ...meta, tags: e.target.value })}
                placeholder={t("bank.tagsPlaceholder")}
              />
            </div>
          </div>
          <QuestionFields question={question} onChange={setQuestion} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
