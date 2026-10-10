"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import toast from "react-hot-toast"
import { BadgeCheck, Eye, EyeOff, HeartHandshake, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { signIn } from "next-auth/react"

export default function RegisterPage() {
  const t = useTranslations("auth")
  const tCommon = useTranslations("common")
  const tFooter = useTranslations("footer")
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const tp = useTranslations("parent.register")
  const [userType, setUserType] = useState<"student" | "instructor" | "parent">("student")

  // Weekly-report links for guardians open /register?role=parent.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("role") === "parent") setUserType("parent")
  }, [])

  const registerSchema = z
    .object({
      name: z.string().min(2, t("nameMinLength")),
      email: z.string().email(t("invalidEmail")),
      phone: z.string().optional(),
      password: z.string().min(6, t("passwordMinLength")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("passwordMismatch"),
      path: ["confirmPassword"],
    })
    .refine(
      (data) => userType !== "parent" || /^\+?[\d\s-]{10,20}$/.test(data.phone?.trim() ?? ""),
      { message: tp("phoneInvalid"), path: ["phone"] }
    )

  type RegisterFormData = z.infer<typeof registerSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          phone: userType === "parent" ? data.phone?.trim() : undefined,
          role: userType === "instructor" ? "INSTRUCTOR" : userType === "parent" ? "PARENT" : "STUDENT",
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || t("genericError"))
      }

      toast.success(t("registerSuccess"))

      // Auto login after registration
      await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      // New instructors continue straight to their application form.
      // Parents go to their dashboard to link a child.
      // A same-site callbackUrl (e.g. an organization invite link) wins.
      const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl")
      const safeCallback =
        callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : null
      router.push(
        safeCallback ??
          (userType === "instructor" ? "/instructor-application" : userType === "parent" ? "/parent" : "/")
      )
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: "google" | "github") => {
    setIsLoading(true)
    try {
      await signIn(provider, { callbackUrl: "/" })
    } catch (error) {
      toast.error(t("genericError"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-0 bg-card shadow-none lg:rounded-2xl lg:border lg:shadow-xl lg:shadow-black/5">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-foreground">
          {t("register")}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {t("registerSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Type Selection */}
        <Tabs
          value={userType}
          onValueChange={(v) => setUserType(v as "student" | "instructor" | "parent")}
        >
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="student" className="whitespace-normal px-1 text-xs sm:text-sm">
              {t("registerAsStudent")}
            </TabsTrigger>
            <TabsTrigger value="instructor" className="whitespace-normal px-1 text-xs sm:text-sm">
              {t("registerAsInstructor")}
            </TabsTrigger>
            <TabsTrigger value="parent" className="whitespace-normal px-1 text-xs sm:text-sm">
              {tp("tab")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {userType === "parent" && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="leading-relaxed text-muted-foreground">{tp("note")}</p>
          </div>
        )}

        {userType === "instructor" && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="leading-relaxed text-muted-foreground">
              {t("instructorApplicationNote")}
            </p>
          </div>
        )}

        {/* Social Login */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-11 border-2"
            onClick={() => handleSocialLogin("google")}
            disabled={isLoading}
          >
            <svg className="ms-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </Button>
          <Button
            variant="outline"
            className="h-11 border-2"
            onClick={() => handleSocialLogin("github")}
            disabled={isLoading}
          >
            <svg className="ms-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
              />
            </svg>
            GitHub
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              {t("orContinueWith")}
            </span>
          </div>
        </div>

        {/* Register Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t("namePlaceholder")}
              className="h-11 rounded-lg"
              {...register("name")}
              error={errors.name?.message}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              className="h-11 rounded-lg"
              {...register("email")}
              error={errors.email?.message}
              disabled={isLoading}
            />
          </div>

          {userType === "parent" && (
            <div className="space-y-2">
              <Label htmlFor="phone">{tp("phone")}</Label>
              <Input
                id="phone"
                type="tel"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                className="h-11 rounded-lg"
                {...register("phone")}
                error={errors.phone?.message}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">{tp("phoneHelp")}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="h-11 rounded-lg"
                {...register("password")}
                error={errors.password?.message}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute end-0 top-0 h-11 w-11"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
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
              className="h-11 rounded-lg"
              {...register("confirmPassword")}
              error={errors.confirmPassword?.message}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            variant="gradient"
            className="h-11 w-full shadow-glow"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            {t("register")}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {t("agreeToTermsPrefix")}{" "}
          <Link href="/terms" className="text-primary hover:underline">
            {tFooter("termsOfService")}
          </Link>{" "}
          {tCommon("and")}{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            {tFooter("privacyPolicy")}
          </Link>
        </p>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          {t("alreadyHaveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            {t("login")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
