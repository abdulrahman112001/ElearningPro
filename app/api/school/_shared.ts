import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { ApiError, apiErrorResponse } from "@/lib/api-error"
import { cleanText, parseDate } from "@/lib/school"

/** Runs a route body, mapping ApiError / Prisma client errors to 4xx and the rest to 500. */
export async function run(label: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error(`${label} error:`, error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/** The signed-in user's session or a 401 ApiError. */
export async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) throw new ApiError(401, "Unauthorized")
  return session
}

export function parseTermBody(body: any, partial: boolean) {
  const out: { name?: string; startsAt?: Date; endsAt?: Date; isCurrent?: boolean } = {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body ?? {}, k)
  if (!partial || has("name")) {
    const name = cleanText(body?.name, 120)
    if (!name) throw new ApiError(400, "Term name is required", { field: "name", code: "required" })
    out.name = name
  }
  if (!partial || has("startsAt")) {
    const d = parseDate(body?.startsAt, "startsAt")
    if (!d) throw new ApiError(400, "Start date is required", { field: "startsAt", code: "required" })
    out.startsAt = d
  }
  if (!partial || has("endsAt")) {
    const d = parseDate(body?.endsAt, "endsAt")
    if (!d) throw new ApiError(400, "End date is required", { field: "endsAt", code: "required" })
    out.endsAt = d
  }
  if (has("isCurrent")) {
    if (typeof body.isCurrent !== "boolean") throw new ApiError(400, "isCurrent must be true or false", { field: "isCurrent" })
    out.isCurrent = body.isCurrent
  }
  return out
}

