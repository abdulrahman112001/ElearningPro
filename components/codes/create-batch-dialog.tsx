"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type CodesScope = "instructor" | "admin"
type CodeType = "COURSE" | "SUBSCRIPTION" | "WALLET"

interface Options {
  courses: { id: string; titleAr: string; titleEn: string; instructor: { id: string; name: string | null } }[]
  instructors: { id: string; name: string | null; email: string }[]
  subscription: { subscriptionEnabled: boolean; monthlyPrice: number } | null
  canCreateWallet: boolean
}

export function CreateBatchDialog({ scope, onCreated }: { scope: CodesScope; onCreated: (batch: { id: string }) => void }) {
  const t = useTranslations("accessCodes")
  const locale = useLocale()
  const [open, setOpen] = React.useState(false)
  const [options, setOptions] = React.useState<Options | null>(null)
  const [type, setType] = React.useState<CodeType>("COURSE")
  const [courseId, setCourseId] = React.useState("")
  const [instructorId, setInstructorId] = React.useState("")
  const [months, setMonths] = React.useState("1")
  const [value, setValue] = React.useState("")
  const [quantity, setQuantity] = React.useState("50")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [name, setName] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open || options) return
    fetch(`/api/${scope}/codes/options`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOptions(d))
      .catch(() => {})
  }, [open, options, scope])

  const title = (c: Options["courses"][number]) => (locale === "ar" ? c.titleAr || c.titleEn : c.titleEn || c.titleAr)
  const types: CodeType[] = options?.canCreateWallet ? ["COURSE", "SUBSCRIPTION", "WALLET"] : ["COURSE", "SUBSCRIPTION"]

  const validate = () => {
    const e: Record<string, string> = {}
    const q = Number(quantity)
    if (!Number.isInteger(q) || q < 1 || q > 1000) e.quantity = t("form.quantityError")
    if (type === "COURSE" && !courseId) e.courseId = t("form.courseRequired")
    if (type === "SUBSCRIPTION") {
      const m = Number(months)
      if (!Number.isInteger(m) || m < 1 || m > 24) e.months = t("form.monthsError")
      if (scope === "admin" && !instructorId) e.instructorId = t("form.teacherRequired")
    }
    if (type === "WALLET") {
      const v = Number(value)
      if (!Number.isFinite(v) || v <= 0 || v > 20000) e.value = t("form.valueError")
    }
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) e.expiresAt = t("form.expiryError")
    return e
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      const res = await fetch(`/api/${scope}/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: name || undefined,
          quantity: Number(quantity),
          courseId: type === "COURSE" ? courseId : undefined,
          instructorId: type === "SUBSCRIPTION" && scope === "admin" ? instructorId : undefined,
          months: type === "SUBSCRIPTION" ? Number(months) : undefined,
          value: type === "WALLET" ? Number(value) : undefined,
          // End of the chosen day, local time
          expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.code === "not_your_course" ? t("errors.notYourCourse") : t("form.createError"))
        return
      }
      toast.success(t("form.created", { count: Number(quantity) }))
      setOpen(false)
      setName("")
      onCreated(data)
    } catch {
      toast.error(t("form.createError"))
    } finally {
      setSaving(false)
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <p className="text-xs text-destructive" role="alert" id={`batch-${k}-error`}>
        {errors[k]}
      </p>
    ) : null

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {t("newBatch")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("newBatch")}</DialogTitle>
            <DialogDescription>{t("form.description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" noValidate id="create-batch-form">
            <div className="space-y-1.5">
              <Label htmlFor="batch-type">{t("form.type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as CodeType)}>
                <SelectTrigger id="batch-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((ty) => (
                    <SelectItem key={ty} value={ty}>
                      {t(`types.${ty}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type === "COURSE" && (
              <div className="space-y-1.5">
                <Label htmlFor="batch-course">{t("form.course")}</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger id="batch-course" aria-invalid={!!errors.courseId}>
                    <SelectValue placeholder={t("form.chooseCourse")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.courses ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {title(c)}
                        {scope === "admin" && c.instructor?.name ? ` · ${c.instructor.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {options && options.courses.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("form.noCourses")}</p>
                )}
                {err("courseId")}
              </div>
            )}

            {type === "SUBSCRIPTION" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {scope === "admin" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="batch-teacher">{t("form.teacher")}</Label>
                    <Select value={instructorId} onValueChange={setInstructorId}>
                      <SelectTrigger id="batch-teacher" aria-invalid={!!errors.instructorId}>
                        <SelectValue placeholder={t("form.chooseTeacher")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(options?.instructors ?? []).map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name || i.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {err("instructorId")}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="batch-months">{t("form.months")}</Label>
                  <Input id="batch-months" type="number" min={1} max={24} value={months} onChange={(e) => setMonths(e.target.value)} dir="ltr" />
                  {err("months")}
                </div>
                {scope === "instructor" && options?.subscription && !options.subscription.subscriptionEnabled && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">{t("form.subscriptionOffHint")}</p>
                )}
              </div>
            )}

            {type === "WALLET" && (
              <div className="space-y-1.5">
                <Label htmlFor="batch-value">{t("form.value")}</Label>
                <Input id="batch-value" type="number" min={1} max={20000} value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" />
                {err("value")}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="batch-quantity">{t("form.quantity")}</Label>
                <Input id="batch-quantity" type="number" min={1} max={1000} value={quantity} onChange={(e) => setQuantity(e.target.value)} dir="ltr" />
                {err("quantity")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-expiry">{t("form.expiresAt")}</Label>
                <Input id="batch-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                {err("expiresAt") ?? <p className="text-xs text-muted-foreground">{t("form.expiresHint")}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-name">{t("form.name")}</Label>
              <Input id="batch-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={t("form.namePlaceholder")} />
            </div>
          </form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button type="submit" form="create-batch-form" disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t("form.generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
