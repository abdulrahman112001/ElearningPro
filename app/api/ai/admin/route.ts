import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { aiModel, isAiConfigured } from "@/lib/ai/client"
import { getDailyLimit } from "@/lib/ai/guard"
import { DAILY_LIMIT_KEY } from "@/lib/ai/validate"

const DAYS = 14

/**
 * GET /api/ai/admin : AI usage per feature and day (last 14 days), top users,
 * the daily limit and whether a key is configured (never the key itself).
 */
export async function GET() {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)
    since.setUTCHours(0, 0, 0, 0)
    const rows = await db.aiUsage.findMany({
      where: { createdAt: { gte: since } },
      select: { userId: true, feature: true, inputTokens: true, outputTokens: true, createdAt: true },
    })

    const byDay = new Map<string, { day: string; feature: string; requests: number; inputTokens: number; outputTokens: number }>()
    const byUser = new Map<string, { requests: number; tokens: number }>()
    const totals = { requests: 0, inputTokens: 0, outputTokens: 0 }
    const features: Record<string, number> = {}
    for (const r of rows) {
      const day = r.createdAt.toISOString().slice(0, 10)
      const key = `${day}:${r.feature}`
      const e = byDay.get(key) ?? { day, feature: r.feature, requests: 0, inputTokens: 0, outputTokens: 0 }
      e.requests += 1
      e.inputTokens += r.inputTokens
      e.outputTokens += r.outputTokens
      byDay.set(key, e)
      const u = byUser.get(r.userId) ?? { requests: 0, tokens: 0 }
      u.requests += 1
      u.tokens += r.inputTokens + r.outputTokens
      byUser.set(r.userId, u)
      totals.requests += 1
      totals.inputTokens += r.inputTokens
      totals.outputTokens += r.outputTokens
      features[r.feature] = (features[r.feature] ?? 0) + 1
    }

    const topIds = Array.from(byUser.entries())
      .sort((a, b) => b[1].requests - a[1].requests)
      .slice(0, 10)
    const users = await db.user.findMany({
      where: { id: { in: topIds.map(([id]) => id) } },
      select: { id: true, name: true, email: true, image: true, role: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    return NextResponse.json({
      configured: isAiConfigured(),
      model: aiModel(),
      dailyLimit: await getDailyLimit(),
      days: DAYS,
      usage: Array.from(byDay.values()).sort((a, b) => b.day.localeCompare(a.day) || a.feature.localeCompare(b.feature)),
      features,
      totals,
      topUsers: topIds.map(([id, stats]) => ({ ...stats, user: userMap.get(id) ?? { id, name: null, email: null, image: null, role: null } })),
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("AI admin stats error:", error)
    return NextResponse.json({ error: "Failed to get AI usage" }, { status: 500 })
  }
}

/** PATCH /api/ai/admin { dailyLimit } : requests per user per day (0-1000, 0 disables AI for everyone). */
export async function PATCH(request: Request) {
  try {
    const { session, error } = await requireAdmin()
    if (error) return error
    const { dailyLimit } = await readJson(request)
    if (typeof dailyLimit !== "number" || !Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > 1000) {
      return NextResponse.json({ error: "dailyLimit must be an integer between 0 and 1000", code: "validation" }, { status: 400 })
    }
    await db.setting.upsert({
      where: { key: DAILY_LIMIT_KEY },
      update: { value: String(dailyLimit) },
      create: { key: DAILY_LIMIT_KEY, value: String(dailyLimit) },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "ai.limit_updated",
      entityType: "Setting",
      entityId: DAILY_LIMIT_KEY,
      summary: `AI daily limit set to ${dailyLimit}`,
      metadata: { dailyLimit },
    })
    return NextResponse.json({ dailyLimit })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("AI admin limit error:", error)
    return NextResponse.json({ error: "Failed to update the limit" }, { status: 500 })
  }
}
