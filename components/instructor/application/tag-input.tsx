"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface TagInputProps {
  id: string
  value: string[]
  onChange: (next: string[]) => void
  max: number
  maxLength?: number
  placeholder?: string
  removeLabel: (tag: string) => string
  disabled?: boolean
  describedBy?: string
}

/** Free-text chips: type, then Enter or a comma to add; Backspace removes the last one. */
export function TagInput({
  id,
  value,
  onChange,
  max,
  maxLength = 60,
  placeholder,
  removeLabel,
  disabled,
  describedBy,
}: TagInputProps) {
  const [draft, setDraft] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const full = value.length >= max

  const commit = (raw: string) => {
    const parts = raw
      .split(/[,،]/)
      .map((p) => p.trim().slice(0, maxLength))
      .filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const p of parts) {
      if (next.length >= max) break
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p)
    }
    onChange(next)
    setDraft("")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === "،") {
      e.preventDefault()
      commit(draft)
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "cursor-not-allowed opacity-50"
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-0.5 pe-1 ps-2.5 text-xs font-medium text-primary"
        >
          <span className="truncate">{tag}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange(value.filter((v) => v !== tag))
            }}
            disabled={disabled}
            aria-label={removeLabel(tag)}
            className="rounded-full p-0.5 transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={(e) => {
          const v = e.target.value
          if (/[,،]/.test(v)) commit(v)
          else setDraft(v)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        disabled={disabled || full}
        maxLength={maxLength}
        placeholder={full ? undefined : placeholder}
        aria-describedby={describedBy}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </div>
  )
}
