"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const RELATIONS = ["father", "mother", "guardian"] as const

/** Links a child using the 8-character code from the student's family page. */
export function AddChildForm() {
  const t = useTranslations("parent.addChild")
  const tr = useTranslations("parent.relations")
  const router = useRouter()
  const [code, setCode] = useState("")
  const [relation, setRelation] = useState<string>("guardian")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch("/api/parent/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, relation }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const key =
          res.status === 429
            ? "tooMany"
            : data.code === "already_linked"
              ? "alreadyLinked"
              : data.code === "parent_limit"
                ? "limit"
                : data.code === "invalid_code"
                  ? "invalidCode"
                  : "generic"
        setError(t(`errors.${key}`))
        return
      }
      toast.success(t("success", { name: data.student?.name ?? "" }))
      setCode("")
      router.refresh()
    } catch {
      setError(t("errors.generic"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("help")}</p>
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <div className="space-y-2">
          <Label htmlFor="child-code">{t("codeLabel")}</Label>
          <Input
            id="child-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD2345"
            maxLength={12}
            autoComplete="off"
            dir="ltr"
            className="h-11 font-mono tracking-[0.3em]"
            aria-invalid={!!error}
            aria-describedby={error ? "child-code-error" : undefined}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="child-relation">{t("relationLabel")}</Label>
          <Select value={relation} onValueChange={setRelation}>
            <SelectTrigger id="child-relation" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {tr(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && (
        <p id="child-code-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || code.trim().length < 8}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        {t("submit")}
      </Button>
    </form>
  )
}
