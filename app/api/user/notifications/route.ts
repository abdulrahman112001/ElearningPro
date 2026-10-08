import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { readJson, apiErrorResponse } from "@/lib/api-error"

// Get notification settings
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // For now, return default settings
    // In production, you would store these in the database
    return NextResponse.json({
      emailNewStudent: true,
      emailNewReview: true,
      emailNewMessage: true,
      emailWeeklyReport: false,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get notifications error:", error)
    return NextResponse.json(
      { error: "Failed to get notifications" },
      { status: 500 }
    )
  }
}

// Update notification settings
export async function PATCH(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await readJson(request)
    const {
      emailNewStudent,
      emailNewReview,
      emailNewMessage,
      emailWeeklyReport,
    } = body

    // For now, just return success
    // In production, you would save these to the database
    // You could add a UserSettings model to the schema

    return NextResponse.json({
      success: true,
      settings: {
        emailNewStudent,
        emailNewReview,
        emailNewMessage,
        emailWeeklyReport,
      },
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update notifications error:", error)
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    )
  }
}
