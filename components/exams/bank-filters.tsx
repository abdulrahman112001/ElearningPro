"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DIFFICULTIES, EXAM_QUESTION_TYPES } from "./types"

export interface GradeLevel {
  id: string
  nameAr: string
  nameEn: string
}

export interface BankFilterValue {
  q: string
  type: string
  difficulty: string
  subject: string
  gradeLevelId: string
  tag: string
}

export const EMPTY_BANK_FILTER: BankFilterValue = {
  q: "",
  type: "",
  difficulty: "",
  subject: "",
  gradeLevelId: "",
  tag: "",
}

export function bankQueryString(f: BankFilterValue, extra: Record<string, string | number> = {}) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v) sp.set(k, v)
  for (const [k, v] of Object.entries(extra)) sp.set(k, String(v))
  return sp.toString()
}

let gradeCache: GradeLevel[] | null = null

/** Active grade levels from /api/grade-levels (cached for the session). */
export function useGradeLevels() {
  const [grades, setGrades] = React.useState<GradeLevel[]>(gradeCache ?? [])
  React.useEffect(() => {
    if (gradeCache) return
    let cancelled = false
    fetch("/api/grade-levels")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: GradeLevel[]) => {
        gradeCache = list
        if (!cancelled) setGrades(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return grades
}

const ALL = "__all"

interface BankFiltersProps {
  value: BankFilterValue
  onChange: (next: BankFilterValue) => void
  subjects: string[]
  tags: string[]
  grades: GradeLevel[]
}

export function BankFilters({ value, onChange, subjects, tags, grades }: BankFiltersProps) {
  const t = useTranslations("exams")
  const locale = useLocale()
  const [q, setQ] = React.useState(value.q)

  React.useEffect(() => setQ(value.q), [value.q])

  // Debounce the search box.
  React.useEffect(() => {
    if (q === value.q) return
    const id = setTimeout(() => onChange({ ...value, q }), 350)
    return () => clearTimeout(id)
  }, [q, value, onChange])

  const select = (
    key: keyof BankFilterValue,
    label: string,
    options: { value: string; label: string }[]
  ) => (
    <Select value={value[key] || ALL} onValueChange={(v) => onChange({ ...value, [key]: v === ALL ? "" : v })}>
      <SelectTrigger aria-label={label} className="min-w-0">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: {t("bank.any")}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("bank.searchPlaceholder")}
          className="ps-9"
          aria-label={t("bank.searchPlaceholder")}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {select(
          "type",
          t("bank.filterType"),
          EXAM_QUESTION_TYPES.map((ty) => ({ value: ty, label: t(`types.${ty}`) }))
        )}
        {select(
          "difficulty",
          t("bank.filterDifficulty"),
          DIFFICULTIES.map((d) => ({ value: d, label: t(`difficulty.${d}`) }))
        )}
        {select(
          "gradeLevelId",
          t("bank.filterGrade"),
          grades.map((g) => ({ value: g.id, label: locale === "ar" ? g.nameAr : g.nameEn }))
        )}
        {select("subject", t("bank.filterSubject"), subjects.map((s) => ({ value: s, label: s })))}
        {select("tag", t("bank.filterTag"), tags.map((s) => ({ value: s, label: `#${s}` })))}
      </div>
    </div>
  )
}
