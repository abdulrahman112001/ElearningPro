"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { BookmarkPlus, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { questionPayload, questionProblem, type EditorQuestion } from "./types"

/** Copies a quiz question into the teacher's question bank. */
export function SaveToBankButton({ question }: { question: EditorQuestion }) {
  const t = useTranslations("exams")
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle")

  const save = async () => {
    const problem = questionProblem(question)
    if (problem) {
      toast.error(t(problem))
      return
    }
    setState("saving")
    try {
      const res = await fetch("/api/instructor/question-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionPayload(question)),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error)
      setState("saved")
      toast.success(t("bank.savedToBank"))
    } catch (e: any) {
      setState("idle")
      toast.error(e?.message || t("bank.saveFailed"))
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={save} disabled={state !== "idle"} title={t("bank.saveToBank")}>
      {state === "saving" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === "saved" ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <BookmarkPlus className="h-4 w-4" />
      )}
      <span className="ms-1.5 hidden sm:inline">{state === "saved" ? t("bank.savedShort") : t("bank.saveToBank")}</span>
    </Button>
  )
}
