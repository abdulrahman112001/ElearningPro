import { NextResponse } from "next/server"

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * NOTE: This is a best-effort, per-instance limiter. On serverless/multi-instance
 * deployments it should be backed by a shared store (e.g. Upstash Redis) for
 * strong guarantees. It still provides useful protection against naive
 * brute-force and abuse on single-instance / long-lived server deployments.
 */

interface WindowState {
  count: number
  resetAt: number
}

const buckets = new Map<string, WindowState>()

// Periodically clean up expired buckets to avoid unbounded memory growth.
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  buckets.forEach((state, key) => {
    if (state.resetAt <= now) buckets.delete(key)
  })
}

export interface RateLimitOptions {
  /** Unique identifier for the caller (e.g. IP address or user id). */
  identifier: string
  /** Namespace so different endpoints don't share counters. */
  scope: string
  /** Maximum number of requests allowed within the window. */
  limit: number
  /** Window duration in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const { identifier, scope, limit, windowMs } = options
  const now = Date.now()
  cleanup(now)

  const key = `${scope}:${identifier}`
  const state = buckets.get(key)

  if (!state || state.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { success: true, remaining: limit - 1, resetAt }
  }

  if (state.count >= limit) {
    return { success: false, remaining: 0, resetAt: state.resetAt }
  }

  state.count += 1
  return { success: true, remaining: limit - state.count, resetAt: state.resetAt }
}

/** Extract a best-effort client IP from a request. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

/** Build a standard 429 response. */
export function tooManyRequests(resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return NextResponse.json(
    {
      error: "Too many requests. Please try again later.",
      errorAr: "عدد كبير من الطلبات. يرجى المحاولة لاحقاً.",
    },
    {
      status: 429,
      headers: { "Retry-After": retryAfter.toString() },
    }
  )
}
