"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { ShieldCheck } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SectionCard } from "@/components/shared"

/** Course-level switch for the moving name/phone watermark on videos. */
export function WatermarkToggle({ courseId, initial }: { courseId: string; initial: boolean }) {
  const t = useTranslations("videoProtection")
  const [enabled, setEnabled] = useState(initial)
  const [saving, setSaving] = useState(false)

  const change = async (value: boolean) => {
    setEnabled(value)
    setSaving(true)
    try {
      const res = await fetch(`/api/instructor/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watermarkEnabled: value }),
      })
      if (!res.ok) throw new Error()
      toast.success(value ? t("watermarkOn") : t("watermarkOff"))
    } catch {
      setEnabled(!value)
      toast.error(t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard icon={ShieldCheck} title={t("courseCardTitle")} description={t("courseCardDesc")}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="watermark-enabled" className="font-medium">
              {t("watermarkLabel")}
            </Label>
            <p className="text-xs text-muted-foreground">{t("watermarkHint")}</p>
          </div>
          <Switch id="watermark-enabled" checked={enabled} onCheckedChange={change} disabled={saving} />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("maxViewsWhere")}{" "}
          <Link href="/instructor/video-protection" className="font-medium text-primary hover:underline">
            {t("openVideoProtection")}
          </Link>
        </p>
      </div>
    </SectionCard>
  )
}
