import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email through the first configured transport:
 *   1. EMAIL_TRANSPORT=log   -> only logs (tests / local development)
 *   2. RESEND_API_KEY        -> Resend (from: EMAIL_FROM)
 *   3. SMTP_HOST + SMTP_USER -> SMTP via nodemailer
 * Throws when none is configured, so callers can record a failed delivery.
 */
export async function sendEmail({ to, subject, html }: EmailOptions) {
  if (process.env.EMAIL_TRANSPORT === "log") {
    console.log(`[email:log] to=${to} subject=${subject}`);
    return;
  }

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      // Must be an address on a domain verified in Resend. The default only
      // delivers to the Resend account owner's own inbox.
      from: process.env.EMAIL_FROM || "E-Learn <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    return;
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error("Email is not configured: set RESEND_API_KEY or SMTP_HOST/SMTP_USER");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || "E-Learn <noreply@elearn.com>",
    to,
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
}

// Email templates
export const emailTemplates = {
  welcome: (name: string) => ({
    subject: "مرحباً بك في E-Learn",
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">مرحباً بك في E-Learn</h2>
        <p>مرحباً ${name}،</p>
        <p>نحن سعداء بانضمامك إلينا! ابدأ رحلة التعلم الآن واستكشف آلاف الكورسات.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/courses" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">تصفح الكورسات</a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">فريق E-Learn</p>
      </div>
    `,
  }),

  courseEnrollment: (name: string, courseName: string, courseUrl: string) => ({
    subject: `تم التسجيل في ${courseName}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">تم التسجيل بنجاح!</h2>
        <p>مرحباً ${name}،</p>
        <p>تهانينا! لقد تم تسجيلك في كورس "${courseName}" بنجاح.</p>
        <a href="${courseUrl}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">ابدأ التعلم الآن</a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">فريق E-Learn</p>
      </div>
    `,
  }),

  courseCertificate: (name: string, courseName: string, certificateUrl: string) => ({
    subject: `تهانينا! لقد أتممت ${courseName}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">🎉 تهانينا!</h2>
        <p>مرحباً ${name}،</p>
        <p>نفخر بإتمامك كورس "${courseName}" بنجاح!</p>
        <p>شهادتك جاهزة للتحميل:</p>
        <a href="${certificateUrl}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">تحميل الشهادة</a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">فريق E-Learn</p>
      </div>
    `,
  }),

  instructorApproval: (name: string) => ({
    subject: "تم اعتماد حسابك كمعلم",
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">تهانينا! تم اعتماد حسابك</h2>
        <p>مرحباً ${name}،</p>
        <p>يسعدنا إبلاغك بأنه تم اعتماد حسابك كمعلم على منصة E-Learn.</p>
        <p>يمكنك الآن إنشاء ونشر كورساتك الخاصة.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/instructor/courses/create" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">إنشاء كورس جديد</a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">فريق E-Learn</p>
      </div>
    `,
  }),

  paymentSuccess: (name: string, amount: number, courseName: string) => ({
    subject: "تأكيد الدفع",
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">تأكيد الدفع</h2>
        <p>مرحباً ${name}،</p>
        <p>تم استلام دفعتك بنجاح:</p>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>الكورس:</strong> ${courseName}</p>
          <p><strong>المبلغ:</strong> ${amount} ج.م</p>
          <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString("ar-EG")}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">فريق E-Learn</p>
      </div>
    `,
  }),

  liveClassReminder: (name: string, className: string, dateTime: Date, joinUrl: string) => ({
    subject: `تذكير: ${className} يبدأ قريباً`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">تذكير بالحصة المباشرة</h2>
        <p>مرحباً ${name}،</p>
        <p>تذكير بأن الحصة المباشرة "${className}" ستبدأ قريباً.</p>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>الوقت:</strong> ${dateTime.toLocaleString("ar-EG")}</p>
        </div>
        <a href="${joinUrl}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">انضم الآن</a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">فريق E-Learn</p>
      </div>
    `,
  }),
};
