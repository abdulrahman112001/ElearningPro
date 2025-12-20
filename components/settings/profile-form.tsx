"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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

const profileSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  email: z.string().email("البريد الإلكتروني غير صالح"),
  bio: z.string().max(500, "النبذة يجب ألا تتجاوز 500 حرف").optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

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
  const [isLoading, setIsLoading] = useState(false)

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

      toast.success("تم تحديث الملف الشخصي بنجاح")
      router.refresh()
    } catch (error) {
      toast.error("حدث خطأ أثناء التحديث")
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
              تغيير الصورة
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG أو GIF. الحد الأقصى 2MB
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الاسم الكامل</FormLabel>
                <FormControl>
                  <Input placeholder="أدخل اسمك" {...field} />
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
                <FormLabel>البريد الإلكتروني</FormLabel>
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
              <FormLabel>نبذة عنك</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="اكتب نبذة مختصرة عن نفسك..."
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
          حفظ التغييرات
        </Button>
      </form>
    </Form>
  )
}
