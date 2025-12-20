"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const courseSchema = z.object({
  title: z.string().min(5, "العنوان يجب أن يكون 5 أحرف على الأقل"),
  titleAr: z.string().optional(),
  description: z.string().min(50, "الوصف يجب أن يكون 50 حرف على الأقل"),
  categoryId: z.string().min(1, "يرجى اختيار التصنيف"),
  level: z.string().min(1, "يرجى اختيار المستوى"),
  language: z.string().min(1, "يرجى اختيار اللغة"),
});

type CourseFormData = z.infer<typeof courseSchema>;

interface CreateCoursePageProps {
  categories: { id: string; name: string; nameAr?: string }[];
}

export function CreateCourseForm({ categories }: CreateCoursePageProps) {
  const t = useTranslations("instructor");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
  });

  const onSubmit = async (data: CourseFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/instructor/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error();

      const course = await response.json();
      toast.success("تم إنشاء الكورس بنجاح");
      router.push(`/instructor/courses/${course.id}/edit`);
    } catch (error) {
      toast.error("حدث خطأ أثناء إنشاء الكورس");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t("createCourse")}</CardTitle>
          <CardDescription>
            {t("createCourseDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t("courseTitle")} (English)</Label>
              <Input
                id="title"
                placeholder="e.g. Complete Web Development Course"
                {...register("title")}
                error={errors.title?.message}
                disabled={isLoading}
              />
            </div>

            {/* Arabic Title */}
            <div className="space-y-2">
              <Label htmlFor="titleAr">{t("courseTitle")} ({t("arabic")})</Label>
              <Input
                id="titleAr"
                placeholder="مثال: دورة تطوير الويب الشاملة"
                {...register("titleAr")}
                disabled={isLoading}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t("courseDescription")}</Label>
              <Textarea
                id="description"
                placeholder={t("courseDescriptionPlaceholder")}
                {...register("description")}
                rows={5}
                disabled={isLoading}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>{t("category")}</Label>
              <Select onValueChange={(value) => setValue("categoryId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.nameAr || category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && (
                <p className="text-sm text-destructive">{errors.categoryId.message}</p>
              )}
            </div>

            {/* Level */}
            <div className="space-y-2">
              <Label>{t("level")}</Label>
              <Select onValueChange={(value) => setValue("level", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectLevel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEGINNER">{t("beginner")}</SelectItem>
                  <SelectItem value="INTERMEDIATE">{t("intermediate")}</SelectItem>
                  <SelectItem value="ADVANCED">{t("advanced")}</SelectItem>
                  <SelectItem value="ALL_LEVELS">{t("allLevels")}</SelectItem>
                </SelectContent>
              </Select>
              {errors.level && (
                <p className="text-sm text-destructive">{errors.level.message}</p>
              )}
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label>{t("language")}</Label>
              <Select onValueChange={(value) => setValue("language", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectLanguage")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AR">{t("arabic")}</SelectItem>
                  <SelectItem value="EN">{t("english")}</SelectItem>
                  <SelectItem value="AR_EN">{t("arabicEnglish")}</SelectItem>
                </SelectContent>
              </Select>
              {errors.language && (
                <p className="text-sm text-destructive">{errors.language.message}</p>
              )}
            </div>

            <div className="flex gap-4">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {t("continue")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
