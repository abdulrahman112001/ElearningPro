"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Library, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState, ListSkeleton } from "@/components/shared"
import { cn } from "@/lib/utils"
import {
  BankFilters,
  EMPTY_BANK_FILTER,
  bankQueryString,
  useGradeLevels,
  type BankFilterValue,
} from "./bank-filters"
import { BankItemSummary, type BankItem } from "./bank-item-summary"
import { toEditorQuestion, type EditorQuestion } from "./types"

interface QuestionBankPickerProps {
  /** Receives copies of the picked bank questions (new ids). */
  onInsert: (questions: EditorQuestion[]) => void
}

/** "From question bank" button + dialog used by the quiz editor. */
export function QuestionBankPicker({ onInsert }: QuestionBankPickerProps) {
  const t = useTranslations("exams")
  const grades = useGradeLevels()
  const [open, setOpen] = React.useState(false)
  const [filter, setFilter] = React.useState<BankFilterValue>(EMPTY_BANK_FILTER)
  const [items, setItems] = React.useState<BankItem[] | null>(null)
  const [facets, setFacets] = React.useState<{ subjects: string[]; tags: string[] }>({ subjects: [], tags: [] })
  const [selected, setSelected] = React.useState<Map<string, BankItem>>(new Map())
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setItems(null)
    setError(false)
    fetch(`/api/instructor/question-bank?${bankQueryString(filter, { pageSize: 100 })}`)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        const data = await r.json()
        if (cancelled) return
        setItems(data.items)
        setFacets({ subjects: data.subjects, tags: data.tags })
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setItems([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, filter])

  const toggle = (item: BankItem) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.set(item.id, item)
      return next
    })

  const insert = () => {
    onInsert(Array.from(selected.values()).map((item) => toEditorQuestion(item)))
    setSelected(new Map())
    setOpen(false)
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Library className="me-2 h-4 w-4" />
        {t("bank.fromBank")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t("bank.pickTitle")}</DialogTitle>
            <DialogDescription>{t("bank.pickDescription")}</DialogDescription>
          </DialogHeader>
          <BankFilters value={filter} onChange={setFilter} subjects={facets.subjects} tags={facets.tags} grades={grades} />
          <div className="-mx-1 min-h-[12rem] flex-1 space-y-2 overflow-y-auto px-1">
            {items === null ? (
              <ListSkeleton rows={4} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Library}
                title={error ? t("bank.loadFailed") : t("bank.emptyTitle")}
                description={error ? undefined : t("bank.pickEmptyHint")}
              />
            ) : (
              items.map((item) => {
                const checked = selected.has(item.id)
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40",
                      checked && "border-primary bg-primary/5"
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(item)} className="mt-0.5" />
                    <BankItemSummary item={item} grades={grades} />
                  </label>
                )
              })
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={insert} disabled={selected.size === 0}>
              {items === null && open ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("bank.addSelected", { count: selected.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
