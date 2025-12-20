import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Update payment methods
export async function PATCH(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { paypalEmail, bankName, bankAccount } = body

    // Update instructor profile
    const profile = await db.instructorProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        paypalEmail: paypalEmail || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
      },
      update: {
        paypalEmail: paypalEmail || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
      },
    })

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error("Error updating payment methods:", error)
    return NextResponse.json(
      { error: "Failed to update payment methods" },
      { status: 500 }
    )
  }
}

// Get payment methods
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await db.instructorProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        paypalEmail: true,
        bankName: true,
        bankAccount: true,
      },
    })

    return NextResponse.json(profile || {})
  } catch (error) {
    console.error("Error fetching payment methods:", error)
    return NextResponse.json(
      { error: "Failed to fetch payment methods" },
      { status: 500 }
    )
  }
}
