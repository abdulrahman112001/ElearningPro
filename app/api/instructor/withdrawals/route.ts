import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Request withdrawal
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { amount, method, paymentDetails } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    if (!method) {
      return NextResponse.json(
        { error: "Payment method is required" },
        { status: 400 }
      )
    }

    // Get instructor profile
    const profile = await db.instructorProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!profile) {
      return NextResponse.json(
        { error: "Instructor profile not found" },
        { status: 404 }
      )
    }

    // Check available balance
    if (amount > profile.pendingEarnings) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      )
    }

    // Minimum withdrawal amount (e.g., $50)
    const minWithdrawal = 50
    if (amount < minWithdrawal) {
      return NextResponse.json(
        { error: `Minimum withdrawal is $${minWithdrawal}` },
        { status: 400 }
      )
    }

    // Check for pending withdrawal
    const pendingWithdrawal = await db.withdrawal.findFirst({
      where: {
        userId: session.user.id,
        status: "PENDING",
      },
    })

    if (pendingWithdrawal) {
      return NextResponse.json(
        { error: "You have a pending withdrawal request" },
        { status: 400 }
      )
    }

    // Create withdrawal request
    const withdrawal = await db.withdrawal.create({
      data: {
        userId: session.user.id,
        amount,
        method,
        note: JSON.stringify(paymentDetails),
        status: "PENDING",
      },
    })

    // Deduct from pending earnings
    await db.instructorProfile.update({
      where: { userId: session.user.id },
      data: {
        pendingEarnings: {
          decrement: amount,
        },
      },
    })

    // Notify admin
    const admins = await db.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    })

    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "SYSTEM" as const,
        title: "New Withdrawal Request",
        message: `Instructor ${session.user.name} requested a withdrawal of $${amount}`,
        link: `/admin/withdrawals/${withdrawal.id}`,
      })),
    })

    return NextResponse.json(withdrawal, { status: 201 })
  } catch (error) {
    console.error("Create withdrawal error:", error)
    return NextResponse.json(
      { error: "Failed to create withdrawal" },
      { status: 500 }
    )
  }
}

// Get withdrawal history
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")

    const where: any = {}

    if (session.user.role === "INSTRUCTOR") {
      where.userId = session.user.id
    }

    const [withdrawals, total] = await Promise.all([
      db.withdrawal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      db.withdrawal.count({ where }),
    ])

    return NextResponse.json({
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Get withdrawals error:", error)
    return NextResponse.json(
      { error: "Failed to get withdrawals" },
      { status: 500 }
    )
  }
}
