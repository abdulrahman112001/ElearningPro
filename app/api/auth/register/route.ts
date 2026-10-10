import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { normalizeEgyptianPhone } from "@/lib/whatsapp"

export async function POST(request: Request) {
  try {
    // Throttle account creation to mitigate spam / abuse
    const limit = rateLimit({
      identifier: getClientIp(request),
      scope: "auth-register",
      limit: 5,
      windowMs: 60_000,
    });
    if (!limit.success) {
      return tooManyRequests(limit.resetAt);
    }

    const body = await readJson(request);
    const { name, password, role } = body;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    // Validate required fields
    if (
      typeof name !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email ||
      !password
    ) {
      return NextResponse.json(
        { error: "جميع الحقول مطلوبة" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "البريد الإلكتروني غير صالح" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 }
      );
    }

    // Check if user already exists
    // Case-insensitive: "A@x.com" and "a@x.com" are the same mailbox.
    const existingUser = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مستخدم بالفعل" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Determine role (default to STUDENT). Admins are never self-registered.
    const userRole =
      role === "INSTRUCTOR" ? "INSTRUCTOR" : role === "PARENT" ? "PARENT" : "STUDENT";

    // Optional phone; required for parents (weekly reports go to WhatsApp).
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if ((userRole === "PARENT" || phone) && (phone.length > 30 || !normalizeEgyptianPhone(phone))) {
      return NextResponse.json(
        { error: "رقم الهاتف غير صالح", code: "invalid_phone", field: "phone" },
        { status: 400 }
      );
    }

    // Create user
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
        ...(phone && { phone }),
        // The adapter's createUser event (which creates the FREE plan) only
        // fires for OAuth sign-ups, so credentials sign-ups get it here.
        subscription: { create: { plan: "FREE", status: "ACTIVE" } },
        // New instructors start unapproved: their courses go to admin review.
        ...(userRole === "INSTRUCTOR" && {
          instructorProfile: { create: { isApproved: false } },
        }),
      },
    });

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      action: "user.registered",
      entityType: "user",
      entityId: user.id,
      summary: `${user.name} registered as ${user.role}`,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      { 
        message: "تم إنشاء الحساب بنجاح",
        user: userWithoutPassword 
      },
      { status: 201 }
    );
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    );
  }
}
