import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/lib/auth"

type Guard = { session: Session; error?: undefined } | { session?: undefined; error: NextResponse }

/** Signed-in instructor or admin, else a ready-made 401/403 response. */
export async function requireInstructor(): Promise<Guard> {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session }
}

/** Signed-in admin, else a ready-made 401/403 response. */
export async function requireAdmin(): Promise<Guard> {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { session }
}
