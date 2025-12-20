import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

// Change password
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword, confirmPassword } = body

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "All fields are required", errorAr: "جميع الحقول مطلوبة" },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords don't match", errorAr: "كلمات المرور غير متطابقة" },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        {
          error: "Password must be at least 6 characters",
          errorAr: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
        },
        { status: 400 }
      )
    }

    // Get user with password
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    })

    if (!user?.password) {
      return NextResponse.json(
        {
          error: "Cannot change password for OAuth accounts",
          errorAr: "لا يمكن تغيير كلمة المرور لحسابات OAuth",
        },
        { status: 400 }
      )
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json(
        {
          error: "Current password is incorrect",
          errorAr: "كلمة المرور الحالية غير صحيحة",
        },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await db.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    })

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    })
  } catch (error) {
    console.error("Change password error:", error)
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    )
  }
}
