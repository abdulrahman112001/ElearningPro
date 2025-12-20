import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مطلوب" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json(
        { message: "إذا كان البريد الإلكتروني موجوداً، ستتلقى رسالة إعادة تعيين" },
        { status: 200 }
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Hash the token before storing
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Save reset token to database
    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry,
      },
    });

    // Create reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

    // Send email
    try {
      await sendEmail({
        to: email,
        subject: "إعادة تعيين كلمة المرور - E-Learn",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">إعادة تعيين كلمة المرور</h2>
            <p>مرحباً ${user.name}،</p>
            <p>لقد طلبت إعادة تعيين كلمة المرور. اضغط على الزر أدناه لتعيين كلمة مرور جديدة:</p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">إعادة تعيين كلمة المرور</a>
            <p>هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
            <p>إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">فريق E-Learn</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // Don't expose email sending errors to user
    }

    return NextResponse.json(
      { message: "تم إرسال رابط إعادة تعيين كلمة المرور" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "حدث خطأ ما" },
      { status: 500 }
    );
  }
}
