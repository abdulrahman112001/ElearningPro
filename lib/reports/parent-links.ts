import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

/** No 0/O, 1/I/L: codes are read aloud and typed from a phone screen. */
export const LINK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
export const LINK_CODE_LENGTH = 8
export const MAX_PARENTS_PER_STUDENT = 4
export const PARENT_RELATIONS = ["father", "mother", "guardian"] as const
export type ParentRelation = (typeof PARENT_RELATIONS)[number]

export function generateLinkCode(): string {
  let code = ""
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)]
  }
  return code
}

/** "abcd-2345 " -> "ABCD2345"; null if it cannot be a link code. */
export function normalizeLinkCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const code = raw.replace(/[\s-]+/g, "").toUpperCase()
  if (code.length !== LINK_CODE_LENGTH) return null
  for (const ch of code) if (!LINK_CODE_ALPHABET.includes(ch)) return null
  return code
}

/**
 * Returns the student's link code, creating it on first use. With
 * `regenerate` the old code stops working immediately.
 */
export async function ensureParentLinkCode(studentId: string, regenerate = false): Promise<string> {
  if (!regenerate) {
    const user = await db.user.findUnique({ where: { id: studentId }, select: { parentLinkCode: true } })
    if (user?.parentLinkCode) return user.parentLinkCode
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateLinkCode()
    try {
      await db.user.update({ where: { id: studentId }, data: { parentLinkCode: code } })
      return code
    } catch (e) {
      // Unique collision: try another code.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue
      throw e
    }
  }
  throw new Error("Could not generate a unique parent link code")
}

/** True when `parentId` has an ACTIVE link to `studentId`. */
export async function isLinkedParent(parentId: string, studentId: string): Promise<boolean> {
  const link = await db.parentLink.findUnique({
    where: { parentId_studentId: { parentId, studentId } },
    select: { status: true },
  })
  return link?.status === "ACTIVE"
}

/** Whether this session may view the student's parent dashboard. */
export async function canViewChild(session: Session, studentId: string): Promise<boolean> {
  if (session.user.role === "ADMIN") return true
  if (session.user.role !== "PARENT") return false
  return isLinkedParent(session.user.id, studentId)
}

type Guard = { session: Session; error?: undefined } | { session?: undefined; error: NextResponse }

/** Signed-in parent (or admin), else a ready-made 401/403 response. */
export async function requireParent(): Promise<Guard> {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "PARENT" && session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session }
}

/** Signed-in student, else a ready-made 401/403 response. */
export async function requireStudent(): Promise<Guard> {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "STUDENT") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session }
}

/** Setting keys for a parent's weekly-report channel opt-outs. */
export const reportOptOutKey = (channel: "whatsapp" | "email", userId: string) =>
  `weekly_report.${channel}_off:${userId}`

export async function getReportOptOuts(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const keys = userIds.flatMap((id) => [reportOptOutKey("whatsapp", id), reportOptOutKey("email", id)])
  const rows = await db.setting.findMany({ where: { key: { in: keys }, value: "1" }, select: { key: true } })
  return new Set(rows.map((r) => r.key))
}
