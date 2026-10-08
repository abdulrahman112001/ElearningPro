"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  User,
  UserCircle,
  Mail,
  Camera,
  Loader2,
  Globe,
  Twitter,
  Linkedin,
  Youtube,
  Save,
  GraduationCap,
  ShieldCheck,
  Phone,
  Share2,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader, SectionCard } from "@/components/shared"
import { Skeleton } from "@/components/ui/skeleton"

interface GradeLevel {
  id: string
  nameAr: string
  nameEn: string
}

const NO_GRADE = "none"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function StudentProfilePage() {
  const t = useTranslations("student")
  const tSettings = useTranslations("settings")
  const tProfile = useTranslations("studentProfile")
  const locale = useLocale()
  const { update } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [guardianEmailError, setGuardianEmailError] = useState(false)
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
    gradeLevelId: "",
    guardianName: "",
    guardianEmail: "",
    guardianPhone: "",
  })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [res, gradesRes] = await Promise.all([
          fetch("/api/user/profile"),
          fetch("/api/grade-levels"),
        ])
        if (gradesRes.ok) {
          const data = await gradesRes.json()
          if (Array.isArray(data)) setGrades(data)
        }
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
            gradeLevelId: data.gradeLevelId || "",
            guardianName: data.guardianName || "",
            guardianEmail: data.guardianEmail || "",
            guardianPhone: data.guardianPhone || "",
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

  const set = (key: keyof typeof profile) => (value: string) =>
    setProfile((p) => ({ ...p, [key]: value }))

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
      setProfile((p) => ({ ...p, image: data.url }))
      toast.success(tSettings("photoUploaded"))
    } catch (error: any) {
      toast.error(error.message || tSettings("uploadFailed"))
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async () => {
    const guardianEmail = profile.guardianEmail.trim()
    if (guardianEmail && !EMAIL_RE.test(guardianEmail)) {
      setGuardianEmailError(true)
      toast.error(tProfile("guardianEmailInvalid"))
      document.getElementById("guardianEmail")?.focus()
      return
    }
    setGuardianEmailError(false)

    setIsLoading(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          // Empty strings clear the stored values
          gradeLevelId: profile.gradeLevelId || null,
          guardianName: profile.guardianName.trim() || null,
          guardianEmail: guardianEmail || null,
          guardianPhone: profile.guardianPhone.trim() || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(
          res.status === 400 && /guardian/i.test(error.error || "")
            ? tProfile("guardianInvalid")
            : error.error
        )
      }

      await update({ name: profile.name, image: profile.image })
      toast.success(tSettings("profileUpdated"))
    } catch (error: any) {
      toast.error(error.message || tSettings("updateFailed"))
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  const gradeName = (g: GradeLevel) => (locale === "ar" ? g.nameAr || g.nameEn : g.nameEn || g.nameAr)

  const saveButton = (
    <Button onClick={handleSubmit} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Save aria-hidden="true" />
      )}
      {tSettings("saveChanges")}
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCircle}
        title={t("profile")}
        description={tSettings("profileDescription")}
        actions={<div className="hidden sm:block">{saveButton}</div>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Photo */}
        <SectionCard title={tSettings("profilePhoto")} icon={Camera}>
          <div className="flex flex-col items-center">
            <div className="group relative">
              <Avatar className="h-32 w-32 ring-4 ring-primary/10">
                <AvatarImage src={profile.image} alt={profile.name} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-3xl text-primary">
                  {profile.name?.charAt(0) || <User className="h-12 w-12" />}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                aria-label={tSettings("changePhoto")}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
              >
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
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
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {tSettings("photoHint")}
            </p>
          </div>
        </SectionCard>

        {/* Personal info */}
        <SectionCard
          className="lg:col-span-2"
          icon={User}
          title={tSettings("personalInfo")}
          description={tSettings("personalInfoDescription")}
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{tSettings("fullName")}</Label>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => set("name")(e.target.value)}
                    className="ps-9"
                    placeholder={tSettings("namePlaceholder")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{tSettings("email")}</Label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" value={profile.email} disabled className="bg-muted ps-9" dir="ltr" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="headline">{tSettings("headline")}</Label>
              <Input
                id="headline"
                value={profile.headline}
                onChange={(e) => set("headline")(e.target.value)}
                placeholder={tProfile("headlinePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">{tSettings("bio")}</Label>
              <Textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => set("bio")(e.target.value)}
                placeholder={tSettings("bioPlaceholder")}
                rows={4}
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Academic grade */}
      <div id="grade" className="scroll-mt-24">
        <SectionCard
          icon={GraduationCap}
          title={tProfile("gradeTitle")}
          description={tProfile("gradeDescription")}
        >
          <div className="max-w-md space-y-2">
            <Label htmlFor="gradeLevel">{tProfile("gradeLabel")}</Label>
            <Select
              value={profile.gradeLevelId || NO_GRADE}
              onValueChange={(v) => set("gradeLevelId")(v === NO_GRADE ? "" : v)}
            >
              <SelectTrigger id="gradeLevel">
                <SelectValue placeholder={tProfile("gradePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GRADE}>{tProfile("gradeNone")}</SelectItem>
                {grades.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {gradeName(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{tProfile("gradeHint")}</p>
          </div>
        </SectionCard>
      </div>

      {/* Guardian contact */}
      <SectionCard
        icon={ShieldCheck}
        title={tProfile("guardianTitle")}
        description={tProfile("guardianDescription")}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-info/20 bg-info/5 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
            <p className="text-muted-foreground">{tProfile("guardianNotice")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="guardianName">{tProfile("guardianName")}</Label>
              <div className="relative">
                <User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="guardianName"
                  value={profile.guardianName}
                  maxLength={100}
                  onChange={(e) => set("guardianName")(e.target.value)}
                  className="ps-9"
                  placeholder={tProfile("guardianNamePlaceholder")}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianEmail">{tProfile("guardianEmail")}</Label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="guardianEmail"
                  type="email"
                  inputMode="email"
                  value={profile.guardianEmail}
                  onChange={(e) => {
                    set("guardianEmail")(e.target.value)
                    if (guardianEmailError) setGuardianEmailError(false)
                  }}
                  className="ps-9"
                  placeholder="parent@example.com"
                  dir="ltr"
                  autoComplete="off"
                  aria-invalid={guardianEmailError}
                  aria-describedby={guardianEmailError ? "guardianEmail-error" : undefined}
                />
              </div>
              {guardianEmailError && (
                <p id="guardianEmail-error" className="text-xs text-destructive">
                  {tProfile("guardianEmailInvalid")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianPhone">{tProfile("guardianPhone")}</Label>
              <div className="relative">
                <Phone className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="guardianPhone"
                  type="tel"
                  inputMode="tel"
                  maxLength={30}
                  value={profile.guardianPhone}
                  onChange={(e) => set("guardianPhone")(e.target.value)}
                  className="ps-9"
                  placeholder="+20 100 000 0000"
                  dir="ltr"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Social links */}
      <SectionCard
        icon={Share2}
        title={tSettings("socialLinks")}
        description={tSettings("socialLinksDescription")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="website">{tSettings("website")}</Label>
            <div className="relative">
              <Globe className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="website"
                value={profile.website}
                onChange={(e) => set("website")(e.target.value)}
                className="ps-9"
                placeholder="https://example.com"
                dir="ltr"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="twitter">Twitter</Label>
            <div className="relative">
              <Twitter className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="twitter"
                value={profile.twitter}
                onChange={(e) => set("twitter")(e.target.value)}
                className="ps-9"
                placeholder="username"
                dir="ltr"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <div className="relative">
              <Linkedin className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="linkedin"
                value={profile.linkedin}
                onChange={(e) => set("linkedin")(e.target.value)}
                className="ps-9"
                placeholder="username"
                dir="ltr"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtube">YouTube</Label>
            <div className="relative">
              <Youtube className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="youtube"
                value={profile.youtube}
                onChange={(e) => set("youtube")(e.target.value)}
                className="ps-9"
                placeholder="channel"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Save (sticky on mobile so it is always reachable) */}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <div className="rounded-lg bg-background/80 p-1 shadow-elevated backdrop-blur sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
          {saveButton}
        </div>
      </div>
    </div>
  )
}
