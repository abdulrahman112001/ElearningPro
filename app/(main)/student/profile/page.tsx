"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import toast from "react-hot-toast"
import {
  User,
  Mail,
  Camera,
  Loader2,
  Globe,
  Twitter,
  Linkedin,
  Youtube,
  Save,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function StudentProfilePage() {
  const t = useTranslations("student")
  const tSettings = useTranslations("settings")
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

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error)
      }

      await update({ name: profile.name, image: profile.image })
      toast.success(tSettings("profileUpdated") || "تم تحديث الملف الشخصي")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
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
      <div>
        <h1 className="text-2xl font-bold">{t("profile")}</h1>
        <p className="text-muted-foreground">
          {tSettings("profileDescription") || "إدارة معلومات حسابك الشخصي"}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Photo Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              {tSettings("profilePhoto") || "صورة الملف الشخصي"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative group">
              <Avatar className="h-32 w-32">
                <AvatarImage src={profile.image} alt={profile.name} />
                <AvatarFallback className="text-3xl">
                  {profile.name?.charAt(0) || <User className="h-12 w-12" />}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {isUploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              {tSettings("photoHint") || "انقر لتغيير الصورة"}
            </p>
          </CardContent>
        </Card>

        {/* Profile Info Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              {tSettings("personalInfo") || "المعلومات الشخصية"}
            </CardTitle>
            <CardDescription>
              {tSettings("personalInfoDescription") ||
                "تحديث معلوماتك الأساسية"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{tSettings("fullName") || "الاسم الكامل"}</Label>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                    className="ps-9"
                    placeholder={tSettings("namePlaceholder") || "أدخل اسمك"}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tSettings("email") || "البريد الإلكتروني"}</Label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={profile.email}
                    disabled
                    className="ps-9 bg-muted"
                  />
                </div>
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
                  tSettings("headlinePlaceholder") || "مثال: مطور ويب | طالب"
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
                  tSettings("bioPlaceholder") || "اكتب نبذة مختصرة عن نفسك..."
                }
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Social Links Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            {tSettings("socialLinks") || "روابط التواصل الاجتماعي"}
          </CardTitle>
          <CardDescription>
            {tSettings("socialLinksDescription") ||
              "أضف روابط حساباتك على مواقع التواصل"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{tSettings("website") || "الموقع الإلكتروني"}</Label>
              <div className="relative">
                <Globe className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={profile.website}
                  onChange={(e) =>
                    setProfile({ ...profile, website: e.target.value })
                  }
                  className="ps-9"
                  placeholder="https://example.com"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Twitter</Label>
              <div className="relative">
                <Twitter className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={profile.twitter}
                  onChange={(e) =>
                    setProfile({ ...profile, twitter: e.target.value })
                  }
                  className="ps-9"
                  placeholder="username"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <div className="relative">
                <Linkedin className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={profile.linkedin}
                  onChange={(e) =>
                    setProfile({ ...profile, linkedin: e.target.value })
                  }
                  className="ps-9"
                  placeholder="username"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>YouTube</Label>
              <div className="relative">
                <Youtube className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={profile.youtube}
                  onChange={(e) =>
                    setProfile({ ...profile, youtube: e.target.value })
                  }
                  className="ps-9"
                  placeholder="channel"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 me-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 me-2" />
          )}
          {tSettings("saveChanges") || "حفظ التغييرات"}
        </Button>
      </div>
    </div>
  )
}
