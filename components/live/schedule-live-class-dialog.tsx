"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import toast from "react-hot-toast"
import { CalendarIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const liveClassSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  courseId: z.string().optional(),
  scheduledDate: z.date({ required_error: "Please select a date" }),
  scheduledTime: z.string().min(1, "Please select a time"),
  duration: z.number().min(15, "Duration must be at least 15 minutes"),
})

type LiveClassFormData = z.infer<typeof liveClassSchema>

interface ScheduleLiveClassDialogProps {
  courses: { id: string; titleEn: string; titleAr: string | null }[]
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function ScheduleLiveClassDialog({
  courses,
  trigger,
  onSuccess,
}: ScheduleLiveClassDialogProps) {
  const t = useTranslations("live")
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<LiveClassFormData>({
    resolver: zodResolver(liveClassSchema),
    defaultValues: {
      title: "",
      titleAr: "",
      description: "",
      descriptionAr: "",
      courseId: "",
      duration: 60,
    },
  })

  const onSubmit = async (data: LiveClassFormData) => {
    setIsSubmitting(true)

    try {
      // Combine date and time
      const [hours, minutes] = data.scheduledTime.split(":").map(Number)
      const scheduledAt = new Date(data.scheduledDate)
      scheduledAt.setHours(hours, minutes, 0, 0)

      const response = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          titleAr: data.titleAr,
          description: data.description,
          descriptionAr: data.descriptionAr,
          courseId:
            data.courseId && data.courseId !== "none" ? data.courseId : null,
          scheduledAt: scheduledAt.toISOString(),
          duration: data.duration,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to schedule class")
      }

      toast.success(t("classScheduled"))
      setOpen(false)
      form.reset()
      onSuccess?.()
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const timeSlots = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of [0, 30]) {
      const h = hour.toString().padStart(2, "0")
      const m = minute.toString().padStart(2, "0")
      timeSlots.push(`${h}:${m}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>{t("scheduleClass")}</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("scheduleClass")}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title (EN) */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("title")} (English)</FormLabel>
                  <FormControl>
                    <Input placeholder="Live class title..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title (AR) */}
            <FormField
              control={form.control}
              name="titleAr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("title")} (عربي)</FormLabel>
                  <FormControl>
                    <Input placeholder="عنوان البث..." dir="rtl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description (EN) */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")} (English)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What will you cover in this class?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description (AR) */}
            <FormField
              control={form.control}
              name="descriptionAr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")} (عربي)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="ما الذي ستغطيه في هذا البث؟"
                      dir="rtl"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Course Selection */}
            <FormField
              control={form.control}
              name="courseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("linkedCourse")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectCourse")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t("noCourse")}</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {locale === "ar" && course.titleAr
                            ? course.titleAr
                            : course.titleEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("date")}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", {
                                locale: locale === "ar" ? ar : enUS,
                              })
                            ) : (
                              <span>{t("pickDate")}</span>
                            )}
                            <CalendarIcon className="ms-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Time */}
              <FormField
                control={form.control}
                name="scheduledTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("time")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("pickTime")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Duration */}
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("duration")}</FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(parseInt(val))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectDuration")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="15">15 {t("minutes")}</SelectItem>
                      <SelectItem value="30">30 {t("minutes")}</SelectItem>
                      <SelectItem value="45">45 {t("minutes")}</SelectItem>
                      <SelectItem value="60">1 {t("hour")}</SelectItem>
                      <SelectItem value="90">1.5 {t("hours")}</SelectItem>
                      <SelectItem value="120">2 {t("hours")}</SelectItem>
                      <SelectItem value="180">3 {t("hours")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                )}
                {t("schedule")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
