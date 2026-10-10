"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Bot, Loader2, SendHorizontal, Sparkles, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AiDisabledNotice, aiErrorKind } from "@/components/ai/ai-disabled-notice"
import { MarkdownLite } from "@/components/ai/markdown-lite"
import { cn } from "@/lib/utils"

const MAX = 2000
const ERROR_MARK = "[[ai_error]]"

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; failed?: boolean }

export interface CourseTutorProps {
  courseId: string
  lessonId?: string
}

/** Floating "Ask the tutor" button with a slide-over chat grounded in the course. */
export function CourseTutor({ courseId, lessonId }: CourseTutorProps) {
  const t = useTranslations("ai")
  const locale = useLocale()
  const rtl = locale === "ar"
  const [open, setOpen] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [disabled, setDisabled] = React.useState<null | "not_configured" | "daily_limit">(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open || loaded) return
    let cancelled = false
    fetch(`/api/ai/tutor?courseId=${encodeURIComponent(courseId)}`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const { kind } = await aiErrorKind(res)
          if (kind === "not_configured") setDisabled("not_configured")
          return
        }
        const data: { messages: { id: string; role: string; content: string }[] } = await res.json()
        setMessages(data.messages.map((m) => ({ id: m.id, role: m.role === "assistant" ? "assistant" : "user", content: m.content })))
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [open, loaded, courseId])

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, open])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const send = async () => {
    const text = input.trim()
    if (!text || sending || text.length > MAX) return
    setSending(true)
    setInput("")
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text }
    const botId = `a-${Date.now()}`
    setMessages((prev) => [...prev, userMsg, { id: botId, role: "assistant", content: "" }])
    const update = (fn: (m: ChatMessage) => ChatMessage) =>
      setMessages((prev) => prev.map((m) => (m.id === botId ? fn(m) : m)))

    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId, message: text }),
      })
      if (!res.ok || !res.body) {
        const { kind, message } = await aiErrorKind(res)
        setMessages((prev) => prev.filter((m) => m.id !== botId && m.id !== userMsg.id))
        setInput(text)
        if (kind !== "other") setDisabled(kind)
        else toast.error(message || t("tutorFailed"))
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        const shown = acc.replace(ERROR_MARK, "").trimEnd()
        update((m) => ({ ...m, content: shown }))
      }
      if (acc.includes(ERROR_MARK)) update((m) => ({ ...m, failed: true }))
    } catch {
      update((m) => ({ ...m, failed: true }))
    } finally {
      setSending(false)
    }
  }

  const clear = async () => {
    const res = await fetch(`/api/ai/tutor?courseId=${encodeURIComponent(courseId)}`, { method: "DELETE" })
    if (res.ok) setMessages([])
    else toast.error(t("tutorFailed"))
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 z-40 h-12 gap-2 rounded-full px-4 shadow-lg end-5",
          open && "hidden"
        )}
        aria-label={t("tutorOpen")}
      >
        <Sparkles className="h-5 w-5" />
        <span className="hidden sm:inline">{t("tutorOpen")}</span>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={t("tutorTitle")}>
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={t("close")}
            onClick={() => setOpen(false)}
          />
          <aside
            className={cn(
              "relative flex h-full w-full max-w-md flex-col border-s bg-background shadow-xl ms-auto",
              "duration-200 animate-in",
              rtl ? "slide-in-from-left" : "slide-in-from-right"
            )}
          >
            <header className="flex items-center gap-3 border-b px-4 py-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t("tutorTitle")}</p>
                <p className="truncate text-xs text-muted-foreground">{t("tutorSubtitle")}</p>
              </div>
              {messages.length > 0 && !disabled && (
                <Button type="button" variant="ghost" size="icon" onClick={clear} aria-label={t("tutorClear")} title={t("tutorClear")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t("close")}>
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {disabled ? (
                <AiDisabledNotice reason={disabled} />
              ) : !loaded ? (
                <div className="flex justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="space-y-2 py-8 text-center text-sm text-muted-foreground">
                  <Sparkles className="mx-auto h-6 w-6 text-primary" />
                  <p className="font-medium text-foreground">{t("tutorEmptyTitle")}</p>
                  <p>{t("tutorEmptyDescription")}</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
                    <div
                      dir="auto"
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                        m.failed && "border border-destructive/50"
                      )}
                    >
                      {m.role === "assistant" ? (
                        m.content ? (
                          <MarkdownLite text={m.content} />
                        ) : m.failed ? null : (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      )}
                      {m.failed && <p className="mt-1 text-xs text-destructive">{t("tutorFailed")}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>

            {!disabled && (
              <form
                className="border-t p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  send()
                }}
              >
                <div className="flex items-end gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, MAX))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    rows={2}
                    dir="auto"
                    placeholder={t("tutorPlaceholder")}
                    className="max-h-40 min-h-[44px] resize-none"
                    disabled={sending}
                  />
                  <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label={t("tutorSend")}>
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizontal className={cn("h-4 w-4", rtl && "rotate-180")} />
                    )}
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{t("tutorDisclaimer")}</p>
              </form>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
