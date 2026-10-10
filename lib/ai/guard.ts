import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { Anthropic, AiOutputError, isAiConfigured, type AiUsageTokens } from "@/lib/ai/client"
import { DAILY_LIMIT_KEY, evaluateDailyLimit, parseDailyLimit, startOfDay } from "@/lib/ai/validate"

/**
 * Check order used by every AI endpoint:
 *   auth (401) -> validation (400) -> resource/permission (404/403)
 *   -> configured (503 ai_not_configured) -> daily limit (429 ai_daily_limit)
 * so callers always learn about their own mistakes first, and the limit only
 * counts requests that would actually reach the model.
 */

export type AiFeature = "generate_questions" | "tutor" | "diagnose"

export function aiNotConfiguredResponse() {
  return NextResponse.json(
    { error: "AI features are not enabled on this server", code: "ai_not_configured" },
    { status: 503 }
  )
}

export async function getDailyLimit(): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: DAILY_LIMIT_KEY }, select: { value: true } })
  return parseDailyLimit(row?.value)
}

export async function getDailyUsage(userId: string) {
  const [used, limit] = await Promise.all([
    db.aiUsage.count({ where: { userId, createdAt: { gte: startOfDay() } } }),
    getDailyLimit(),
  ])
  return evaluateDailyLimit(used, limit)
}

/** 503 when no key is configured, 429 when the user used up today's requests, else null. */
export async function aiAvailabilityResponse(userId: string): Promise<NextResponse | null> {
  if (!isAiConfigured()) return aiNotConfiguredResponse()
  const usage = await getDailyUsage(userId)
  if (usage.exceeded) {
    return NextResponse.json(
      { error: "You reached today's AI request limit", code: "ai_daily_limit", limit: usage.limit, used: usage.used },
      { status: 429 }
    )
  }
  return null
}

export async function recordAiUsage(userId: string, feature: AiFeature, usage: AiUsageTokens) {
  try {
    await db.aiUsage.create({
      data: { userId, feature, model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
    })
  } catch (error) {
    console.error("Record AI usage failed:", error)
  }
}

/** Maps Claude API / model-output failures to a client-safe response; null for anything else. */
export function aiErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AiOutputError) {
    const code = error.reason === "refusal" ? "ai_refused" : "ai_bad_output"
    return NextResponse.json({ error: "The AI could not produce a usable answer", code }, { status: 502 })
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error("Claude API key rejected:", error.message)
    return aiNotConfiguredResponse()
  }
  if (error instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ error: "The AI service is busy, try again shortly", code: "ai_busy" }, { status: 503 })
  }
  if (error instanceof Anthropic.APIError) {
    console.error(`Claude API error ${error.status}:`, error.message)
    return NextResponse.json({ error: "The AI service failed", code: "ai_upstream_error" }, { status: 502 })
  }
  return null
}

/** Reads the UI locale cookie (Arabic is the default). */
export function localeFromRequest(request: Request): "ar" | "en" {
  const cookie = request.headers.get("cookie") ?? ""
  const match = cookie.match(/(?:^|;\s*)locale=(ar|en)\b/)
  return (match?.[1] as "ar" | "en") ?? "ar"
}
