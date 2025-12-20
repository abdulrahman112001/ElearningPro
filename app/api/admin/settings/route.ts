import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const DEFAULT_SETTINGS = {
  siteName: "E-Learning Platform",
  siteDescription: "Learn anything, anytime, anywhere",
  platformFee: 10,
  minWithdrawal: 50,
  currency: "USD",
  supportEmail: "support@example.com",
  allowRegistration: true,
  requireEmailVerification: false,
  maintenanceMode: false,
  paymentGateways: {
    stripe: { enabled: true },
    paypal: { enabled: true },
    paymob: { enabled: false },
    tap: { enabled: false },
  },
}

// GET - Fetch all settings
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settingsRecords = await db.setting.findMany()

    // Convert array of settings to object
    const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS }

    for (const record of settingsRecords) {
      try {
        settings[record.key] = JSON.parse(record.value)
      } catch {
        settings[record.key] = record.value
      }
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    )
  }
}

// PUT - Update settings
export async function PUT(request: Request) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid settings" }, { status: 400 })
    }

    // Save each setting
    const updates = Object.entries(body).map(([key, value]) => {
      const stringValue =
        typeof value === "object" ? JSON.stringify(value) : String(value)

      return db.setting.upsert({
        where: { key },
        create: { key, value: stringValue },
        update: { value: stringValue },
      })
    })

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update settings error:", error)
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    )
  }
}
