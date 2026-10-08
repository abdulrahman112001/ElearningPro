"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useTranslations } from "next-intl"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import toast from "react-hot-toast"
import { getInitials } from "@/lib/utils"

const makeProfileSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(2, t("nameMin")),
    email: z.string().email(t("invalidEmail")),
    bio: z.string().max(500, t("bioMax")).optional(),
  })

type ProfileFormValues = z.infer<ReturnType<typeof makeProfileSchema>>

interface ProfileFormProps {
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    bio: string | null
  }
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter()
  const t = useTranslations("settingsForms.profile")
  const ts = useTranslations("settings")
  const [isLoading, setIsLoading] = useState(false)

  const profileSchema = useMemo(() => makeProfileSchema(t), [t])

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name || "",
      email: user.email || "",
      bio: user.bio || "",
    },
  })

  const onSubmit = async (data: ProfileFormValues) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Failed to update profile")
      }

      toast.success(t("updated"))
      router.refresh()
    } catch (error) {
      toast.error(t("updateError"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.image || ""} />
            <AvatarFallback className="text-xl">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button type="button" variant="outline" size="sm">
              <Upload className="h-4 w-4 ms-2" />
              {ts("changePhoto")}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              {t("photoFormats")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{ts("fullName")}</FormLabel>
                <FormControl>
                  <Input placeholder={ts("namePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{ts("email")}</FormLabel>
                <FormControl>
                  <Input type="email" disabled {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{ts("bio")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("bioPlaceholder")}
                  className="resize-none"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          {ts("saveChanges")}
        </Button>
      </form>
    </Form>
  )
}
