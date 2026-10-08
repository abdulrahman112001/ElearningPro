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
  const pending = pendingInstructorResponse(session)
  if (pending) return { error: pending }
  return { session }
}

/**
 * 403 for an instructor whose application an admin has not approved yet,
 * else null. Use it in instructor-only routes that do not go through
 * requireInstructor().
 */
export function pendingInstructorResponse(session: Session): NextResponse | null {
  if (session.user.role === "INSTRUCTOR" && session.user.instructorApproved === false) {
    return NextResponse.json(
      { error: "Your instructor application is awaiting admin approval", code: "instructor_not_approved" },
      { status: 403 }
    )
  }
  return null
}

/** Signed-in admin, else a ready-made 401/403 response. */
export async function requireAdmin(): Promise<Guard> {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { session }
}
