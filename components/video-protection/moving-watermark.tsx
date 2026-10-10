"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface MovingWatermarkProps {
  text: string
  /** Milliseconds between jumps. */
  interval?: number
  className?: string
}

function randomPosition() {
  return {
    top: 6 + Math.random() * 74, // %
    start: 4 + Math.random() * 56, // %
  }
}

/**
 * Semi-transparent viewer name/phone that jumps around the video so a screen
 * recording always identifies who leaked it. Click-through, and rendered
 * inside the player wrapper so it stays visible in fullscreen.
 */
export function MovingWatermark({ text, interval = 5000, className }: MovingWatermarkProps) {
  const [pos, setPos] = useState({ top: 10, start: 8 })

  useEffect(() => {
    setPos(randomPosition())
    const timer = setInterval(() => setPos(randomPosition()), interval)
    return () => clearInterval(timer)
  }, [interval])

  if (!text) return null

  return (
    <div
      aria-hidden="true"
      data-testid="video-watermark"
      className={cn("pointer-events-none absolute inset-0 z-20 select-none overflow-hidden", className)}
    >
      <span
        className="absolute max-w-[80%] truncate whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold text-white/40 transition-all duration-1000 ease-in-out [text-shadow:0_0_3px_rgba(0,0,0,0.6)] sm:text-sm"
        style={{ top: `${pos.top}%`, insetInlineStart: `${pos.start}%` }}
        dir="auto"
      >
        {text}
      </span>
    </div>
  )
}
