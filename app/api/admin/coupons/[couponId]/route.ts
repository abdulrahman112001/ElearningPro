import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"

export async function PATCH(
  request: Request,
  { params }: { params: { couponId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await readJson(request)

    const existing = await db.coupon.findUnique({ where: { id: params.couponId } })
    if (!existing) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 })
    }

    // Same rules as creation: only known discount types, sane values.
    if (body.discountType !== undefined && !["percentage", "fixed"].includes(body.discountType)) {
      return NextResponse.json({ error: "Unsupported discount type" }, { status: 400 })
    }
    if (body.discountValue !== undefined && typeof body.discountValue !== "number") {
      return NextResponse.json({ error: "discountValue must be a number" }, { status: 400 })
    }
    const type = body.discountType ?? existing.discountType
    const value = body.discountValue ?? existing.discountValue
    if (value <= 0 || (type === "percentage" && value > 100)) {
      return NextResponse.json({ error: "Invalid discount value" }, { status: 400 })
    }
    if (body.code !== undefined && (typeof body.code !== "string" || !body.code.trim())) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 })
    }

    const coupon = await db.coupon.update({
      where: { id: params.couponId },
      data: {
        // Codes are matched upper-cased at checkout, so store them that way.
        ...(body.code && { code: body.code.trim().toUpperCase() }),
        ...(body.discountType && { discountType: body.discountType }),
        ...(typeof body.discountValue === "number" && {
          discountValue: body.discountValue,
        }),
        ...(typeof body.maxUses === "number" && { maxUses: body.maxUses }),
        ...(typeof body.minPurchase === "number" && {
          minPurchase: body.minPurchase,
        }),
        ...(typeof body.maxDiscount === "number" && {
          maxDiscount: body.maxDiscount,
        }),
        ...(body.expiryDate && { expiryDate: new Date(body.expiryDate) }),
        ...(typeof body.isActive === "boolean" && { isActive: body.isActive }),
        ...(body.courseId !== undefined && { courseId: body.courseId || null }),
      },
    })

    return NextResponse.json(coupon)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update coupon error:", error)
    return NextResponse.json(
      { error: "Failed to update coupon" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { couponId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.coupon.delete({ where: { id: params.couponId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete coupon error:", error)
    return NextResponse.json(
      { error: "Failed to delete coupon" },
      { status: 500 }
    )
  }
}
