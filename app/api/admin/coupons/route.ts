import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await readJson(request)
    const {
      code,
      discountType,
      discountValue,
      maxUses,
      minPurchase,
      maxDiscount,
      expiryDate,
      courseId,
    } = body

    if (!code || !discountType || typeof discountValue !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    if (!["percentage", "fixed"].includes(discountType)) {
      return NextResponse.json(
        { error: "Unsupported discount type" },
        { status: 400 }
      )
    }

    if (typeof code !== "string" || discountValue <= 0 || (discountType === "percentage" && discountValue > 100)) {
      return NextResponse.json({ error: "Invalid discount value" }, { status: 400 })
    }

    const existing = await db.coupon.findUnique({ where: { code: code.toUpperCase() } })

    if (existing) {
      return NextResponse.json(
        { error: "Coupon already exists" },
        { status: 409 }
      )
    }

    const coupon = await db.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountValue,
        maxUses: typeof maxUses === "number" ? maxUses : null,
        minPurchase: typeof minPurchase === "number" ? minPurchase : null,
        maxDiscount: typeof maxDiscount === "number" ? maxDiscount : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        courseId: courseId || null,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(coupon, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create coupon error:", error)
    return NextResponse.json(
      { error: "Failed to create coupon" },
      { status: 500 }
    )
  }
}
