"use client"

import { useTranslations } from "next-intl"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

/** Friendly "AI isn't enabled yet" / "limit reached" state shared by the AI components. */
export function AiDisabledNotice({
  reason = "not_configured",
  className,
}: {
  reason?: "not_configured" | "daily_limit"
  className?: string
}) {
  const t = useTranslations("ai")
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-4 py-8 text-center",
        className
      )}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="font-medium">{reason === "daily_limit" ? t("limitTitle") : t("disabledTitle")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {reason === "daily_limit" ? t("limitDescription") : t("disabledDescription")}
      </p>
    </div>
  )
}

export type AiErrorKind = "not_configured" | "daily_limit" | "other"

/** Classifies an AI endpoint response. */
export async function aiErrorKind(res: Response): Promise<{ kind: AiErrorKind; message?: string }> {
  let body: { code?: string; error?: string } = {}
  try {
    body = await res.clone().json()
  } catch {
    /* not JSON */
  }
  if (res.status === 503 && body.code === "ai_not_configured") return { kind: "not_configured" }
  if (res.status === 429 && body.code === "ai_daily_limit") return { kind: "daily_limit" }
  return { kind: "other", message: body.error }
}
