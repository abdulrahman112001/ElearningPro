"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import {
  User,
  Mail,
  Phone,
  Globe,
  Bell,
  CreditCard,
  Shield,
  Loader2,
  Camera,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PaymentMethodsManager } from "@/components/instructor/payment-methods-manager"

export default function InstructorSettingsPage() {
  const t = useTranslations("instructor")
  const tSettings = useTranslations("settings")
  const router = useRouter()
  const { data: session, update } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    image: "",
    bio: "",
    headline: "",
    website: "",
    twitter: "",
    linkedin: "",
    youtube: "",
  })

  const [notifications, setNotifications] = useState({
    emailNewStudent: true,
    emailNewReview: true,
    emailNewMessage: true,
    emailWeeklyReport: false,
  })

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [isPasswordLoading, setIsPasswordLoading] = useState(false)

  const [paymentMethods, setPaymentMethods] = useState({
    paypalEmail: null as string | null,
    bankName: null as string | null,
    bankAccount: null as string | null,
  })

  // Function to fetch payment methods
  const fetchPaymentMethods = async () => {
    try {
      const paymentRes = await fetch("/api/instructor/payment-methods")
      if (paymentRes.ok) {
        const paymentData = await paymentRes.json()
        setPaymentMethods({
          paypalEmail: paymentData.paypalEmail || null,
          bankName: paymentData.bankName || null,
          bankAccount: paymentData.bankAccount || null,
        })
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error)
    }
  }

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/user/profile")
        if (res.ok) {
          const data = await res.json()
          setProfile({
            name: data.name || "",
            email: data.email || "",
            image: data.image || "",
            bio: data.bio || "",
            headline: data.headline || "",
            website: data.website || "",
            twitter: data.twitter || "",
            linkedin: data.linkedin || "",
            youtube: data.youtube || "",
          })
        }

        // Fetch payment methods
        await fetchPaymentMethods()
      } catch (error) {
        console.error("Error fetching profile:", error)
      } finally {
        setIsFetching(false)
      }
    }
    fetchProfile()
  }, [])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "avatars")

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.errorAr || error.error)
      }

      const data = await res.json()
      setProfile({ ...profile, image: data.url })
      toast.success(tSettings("photoUploaded") || "تم رفع الصورة بنجاح")
    } catch (error: any) {
      toast.error(
        error.message || tSettings("uploadFailed") || "فشل رفع الصورة"
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleProfileSave = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })

      if (!response.ok) throw new Error("Failed to update profile")

      // Update session with new data
      await update({
        ...session,
        user: {
          ...session?.user,
          name: profile.name,
          image: profile.image,
        },
      })

      toast.success(tSettings("profileUpdated") || "تم تحديث الملف الشخصي")
      router.refresh()
    } catch (error) {
      toast.error(tSettings("updateFailed") || "فشل التحديث")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNotificationsSave = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifications),
      })

      if (!response.ok) throw new Error("Failed to update notifications")

      toast.success(
        tSettings("notificationsUpdated") || "تم تحديث إعدادات الإشعارات"
      )
    } catch (error) {
      toast.error(tSettings("updateFailed") || "فشل التحديث")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    if (
      !passwords.currentPassword ||
      !passwords.newPassword ||
      !passwords.confirmPassword
    ) {
      toast.error(tSettings("allFieldsRequired") || "جميع الحقول مطلوبة")
      return
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error(tSettings("passwordsDontMatch") || "كلمات المرور غير متطابقة")
      return
    }

    if (passwords.newPassword.length < 6) {
      toast.error(
        tSettings("passwordTooShort") ||
          "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
      )
      return
    }

    setIsPasswordLoading(true)
    try {
      const response = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwords),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.errorAr || error.error)
      }

      toast.success(
        tSettings("passwordUpdated") || "تم تحديث كلمة المرور بنجاح"
      )
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error: any) {
      toast.error(error.message || tSettings("updateFailed") || "فشل التحديث")
    } finally {
      setIsPasswordLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("settings")}</h1>
        <p className="text-muted-foreground">
          {t("settingsDescription") || "إدارة إعدادات حسابك"}
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            {tSettings("profile") || "الملف الشخصي"}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            {tSettings("notifications") || "الإشعارات"}
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2">
            <CreditCard className="h-4 w-4" />
            {tSettings("payment") || "الدفع"}
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            {tSettings("security") || "الأمان"}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {tSettings("basicInfo") || "المعلومات الأساسية"}
              </CardTitle>
              <CardDescription>
                {tSettings("basicInfoDescription") ||
                  "هذه المعلومات ستظهر في صفحتك العامة"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile.image || undefined} />
                    <AvatarFallback className="text-2xl">
                      {profile.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Camera className="h-4 w-4 me-2" />
                    {tSettings("changePhoto") || "تغيير الصورة"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tSettings("name") || "الاسم"}</Label>
                  <Input
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tSettings("email") || "البريد الإلكتروني"}</Label>
                  <Input value={profile.email} disabled className="bg-muted" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{tSettings("headline") || "العنوان المهني"}</Label>
                <Input
                  value={profile.headline}
                  onChange={(e) =>
                    setProfile({ ...profile, headline: e.target.value })
                  }
                  placeholder={
                    tSettings("headlinePlaceholder") || "مثال: مطور ويب محترف"
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{tSettings("bio") || "نبذة عنك"}</Label>
                <Textarea
                  value={profile.bio}
                  onChange={(e) =>
                    setProfile({ ...profile, bio: e.target.value })
                  }
                  placeholder={
                    tSettings("bioPlaceholder") || "اكتب نبذة مختصرة عنك..."
                  }
                  rows={4}
                />
              </div>

              <Button onClick={handleProfileSave} disabled={isLoading}>
                {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {tSettings("saveChanges") || "حفظ التغييرات"}
              </Button>
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle>
                {tSettings("socialLinks") || "الروابط الاجتماعية"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {tSettings("website") || "الموقع الإلكتروني"}
                  </Label>
                  <Input
                    value={profile.website}
                    onChange={(e) =>
                      setProfile({ ...profile, website: e.target.value })
                    }
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Twitter</Label>
                  <Input
                    value={profile.twitter}
                    onChange={(e) =>
                      setProfile({ ...profile, twitter: e.target.value })
                    }
                    placeholder="@username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input
                    value={profile.linkedin}
                    onChange={(e) =>
                      setProfile({ ...profile, linkedin: e.target.value })
                    }
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>YouTube</Label>
                  <Input
                    value={profile.youtube}
                    onChange={(e) =>
                      setProfile({ ...profile, youtube: e.target.value })
                    }
                    placeholder="https://youtube.com/@channel"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>
                {tSettings("emailNotifications") || "إشعارات البريد"}
              </CardTitle>
              <CardDescription>
                {tSettings("emailNotificationsDescription") ||
                  "اختر الإشعارات التي تريد استلامها عبر البريد"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {tSettings("newStudentEnrollment") || "تسجيل طالب جديد"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tSettings("newStudentEnrollmentDesc") ||
                      "عندما يسجل طالب في أحد كورساتك"}
                  </p>
                </div>
                <Switch
                  checked={notifications.emailNewStudent}
                  onCheckedChange={(v) =>
                    setNotifications({ ...notifications, emailNewStudent: v })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {tSettings("newReview") || "تقييم جديد"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tSettings("newReviewDesc") ||
                      "عندما يضيف طالب تقييماً لكورسك"}
                  </p>
                </div>
                <Switch
                  checked={notifications.emailNewReview}
                  onCheckedChange={(v) =>
                    setNotifications({ ...notifications, emailNewReview: v })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {tSettings("newMessage") || "رسالة جديدة"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tSettings("newMessageDesc") || "عندما تستلم رسالة من طالب"}
                  </p>
                </div>
                <Switch
                  checked={notifications.emailNewMessage}
                  onCheckedChange={(v) =>
                    setNotifications({ ...notifications, emailNewMessage: v })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {tSettings("weeklyReport") || "التقرير الأسبوعي"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tSettings("weeklyReportDesc") ||
                      "ملخص أسبوعي لأداء كورساتك"}
                  </p>
                </div>
                <Switch
                  checked={notifications.emailWeeklyReport}
                  onCheckedChange={(v) =>
                    setNotifications({ ...notifications, emailWeeklyReport: v })
                  }
                />
              </div>

              <Button onClick={handleNotificationsSave} disabled={isLoading}>
                {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {tSettings("saveChanges") || "حفظ التغييرات"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle>
                {tSettings("paymentMethods") || "طرق الدفع"}
              </CardTitle>
              <CardDescription>
                {tSettings("paymentMethodsDescription") ||
                  "إدارة طرق استلام الأرباح"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentMethodsManager
                paypalEmail={paymentMethods.paypalEmail}
                bankName={paymentMethods.bankName}
                bankAccount={paymentMethods.bankAccount}
                onUpdate={fetchPaymentMethods}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>
                {tSettings("changePassword") || "تغيير كلمة المرور"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>
                  {tSettings("currentPassword") || "كلمة المرور الحالية"}
                </Label>
                <Input
                  type="password"
                  value={passwords.currentPassword}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      currentPassword: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {tSettings("newPassword") || "كلمة المرور الجديدة"}
                </Label>
                <Input
                  type="password"
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, newPassword: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {tSettings("confirmPassword") || "تأكيد كلمة المرور"}
                </Label>
                <Input
                  type="password"
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      confirmPassword: e.target.value,
                    })
                  }
                />
              </div>
              <Button
                onClick={handlePasswordChange}
                disabled={isPasswordLoading}
              >
                {isPasswordLoading && (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                )}
                {tSettings("updatePassword") || "تحديث كلمة المرور"}
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-destructive">
                {tSettings("dangerZone") || "منطقة الخطر"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {tSettings("deleteAccountWarning") ||
                  "حذف حسابك سيؤدي لحذف جميع بياناتك وكورساتك بشكل نهائي"}
              </p>
              <Button variant="destructive">
                {tSettings("deleteAccount") || "حذف الحساب"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
