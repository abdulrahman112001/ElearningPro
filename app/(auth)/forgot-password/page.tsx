"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const forgotPasswordSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("حدث خطأ ما");
      }

      setIsSubmitted(true);
      toast.success("تم إرسال رابط إعادة تعيين كلمة المرور");
    } catch (error) {
      toast.error("حدث خطأ ما. حاول مرة أخرى");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="border-0 shadow-none lg:border lg:shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">تحقق من بريدك الإلكتروني</CardTitle>
          <CardDescription className="pt-2">
            لقد أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.
            يرجى التحقق من صندوق الوارد والرسائل غير المرغوب فيها.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsSubmitted(false)}
          >
            إعادة الإرسال
          </Button>
        </CardContent>
        <CardFooter className="justify-center">
          <Link
            href="/login"
            className="flex items-center text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="ms-2 h-4 w-4" />
            العودة لتسجيل الدخول
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none lg:border lg:shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("forgotPassword")}</CardTitle>
        <CardDescription>
          أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              {...register("email")}
              error={errors.email?.message}
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            {t("sendResetLink")}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <Link
          href="/login"
          className="flex items-center text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="ms-2 h-4 w-4" />
          العودة لتسجيل الدخول
        </Link>
      </CardFooter>
    </Card>
  );
}
