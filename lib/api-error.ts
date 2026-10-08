import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

/**
 * Error carrying an HTTP status. Throw it from a route handler (or from a
 * helper it calls) and the route's catch block turns it into a JSON response
 * through `apiErrorResponse`.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/**
 * Reads a JSON request body. A missing or malformed body is a client error
 * (400), not a server crash.
 */
export async function readJson<T = any>(request: Request): Promise<T> {
  let text: string
  try {
    text = await request.text()
  } catch {
    throw new ApiError(400, "Invalid request body")
  }
  if (!text.trim()) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError(400, "Malformed JSON body")
  }
}

/**
 * Maps errors that are the client's fault to 4xx responses. Returns null for
 * anything else so the caller falls through to its own 500 handling.
 */
export function apiErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, ...error.extra }, { status: error.status })
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    // Wrong type / unknown enum value / invalid pagination coming from input.
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2025": // record to update/delete not found
      case "P2001":
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      case "P2003": // foreign key points at a missing record
        return NextResponse.json({ error: "Related record not found" }, { status: 404 })
      case "P2002":
        return NextResponse.json({ error: "Already exists" }, { status: 409 })
      case "P2000": // value too long
      case "P2006":
      case "P2007":
        return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
  }
  return null
}
