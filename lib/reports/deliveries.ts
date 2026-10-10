import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

export const DELIVERY_CHANNELS = ["WHATSAPP", "EMAIL", "SMS"] as const
export const DELIVERY_STATUSES = ["SENT", "LOGGED", "FAILED"] as const
export const DELIVERY_PAGE_SIZE = 25

/** Admin delivery log: filtered page + counts by status (last 30 days). */
export async function queryDeliveries(input: {
  channel?: string | null
  template?: string | null
  status?: string | null
  page?: number
}) {
  const where: Prisma.MessageDeliveryWhereInput = {}
  if (input.channel && (DELIVERY_CHANNELS as readonly string[]).includes(input.channel)) where.channel = input.channel
  if (input.status && (DELIVERY_STATUSES as readonly string[]).includes(input.status)) where.status = input.status
  if (input.template && /^[a-z0-9_.-]{1,60}$/i.test(input.template)) where.template = input.template
  const page = Number.isFinite(input.page) && (input.page ?? 1) > 0 ? Math.floor(input.page ?? 1) : 1
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [items, total, byStatus, templates] = await Promise.all([
    db.messageDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * DELIVERY_PAGE_SIZE,
      take: DELIVERY_PAGE_SIZE,
      select: {
        id: true,
        channel: true,
        to: true,
        template: true,
        status: true,
        error: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.messageDelivery.count({ where }),
    db.messageDelivery.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.messageDelivery.findMany({ distinct: ["template"], select: { template: true }, take: 50 }),
  ])
  const counts: Record<string, number> = { SENT: 0, LOGGED: 0, FAILED: 0 }
  for (const r of byStatus) counts[r.status] = r._count._all
  return {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / DELIVERY_PAGE_SIZE)),
    counts,
    templates: templates.map((t) => t.template).sort(),
  }
}
