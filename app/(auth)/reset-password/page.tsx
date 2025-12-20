"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/validate-reset-token?token=${token}`);
        setIsValidToken(response.ok);
      } catch (error) {
        setIsValidToken(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      });

      if (!response.ok) {
        throw new Error("حدث خطأ ما");
      }

      setIsSubmitted(true);
      toast.success("تم تغيير كلمة المرور بنجاح");
    } catch (error) {
      toast.error("حدث خطأ ما. حاول مرة أخرى");
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <Card className="border-0 shadow-none lg:border lg:shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!token || !isValidToken) {
    return (
      <Card className="border-0 shadow-none lg:border lg:shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">رابط غير صالح</CardTitle>
          <CardDescription className="pt-2">
            رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية.
            يرجى طلب رابط جديد.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full">
            <Link href="/forgot-password">طلب رابط جديد</Link>
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

  if (isSubmitted) {
    return (
      <Card className="border-0 shadow-none lg:border lg:shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <CardTitle className="text-2xl">تم تغيير كلمة المرور</CardTitle>
          <CardDescription className="pt-2">
            تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none lg:border lg:shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("resetPassword")}</CardTitle>
        <CardDescription>
          أدخل كلمة المرور الجديدة
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                {...register("password")}
                error={errors.password?.message}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute start-0 top-0 h-10 w-10"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              error={errors.confirmPassword?.message}
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            {t("resetPassword")}
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
