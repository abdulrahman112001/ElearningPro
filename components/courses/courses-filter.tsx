"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { GraduationCap, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GradeOption {
  id: string;
  nameAr: string;
  nameEn: string;
}

interface CoursesFilterProps {
  totalCourses: number;
  /** Academic grades for the ?grade= filter */
  grades?: GradeOption[];
  /** The signed-in student's grade, offered as a shortcut */
  myGradeId?: string | null;
}

const ALL_GRADES = "all";

export function CoursesFilter({ totalCourses, grades = [], myGradeId = null }: CoursesFilterProps) {
  const t = useTranslations("courses");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateSearchParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // Reset page when filters change
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push(pathname || "/courses");
  };

  const hasFilters =
    searchParams?.get("category") ||
    searchParams?.get("grade") ||
    searchParams?.get("level") ||
    searchParams?.get("price") ||
    searchParams?.get("rating") ||
    searchParams?.get("duration") ||
    searchParams?.get("search");

  const gradeName = (g: GradeOption) =>
    (locale === "ar" ? g.nameAr || g.nameEn : g.nameEn || g.nameAr) || "";
  const selectedGrade = searchParams?.get("grade") || "";
  const myGrade = myGradeId ? grades.find((g) => g.id === myGradeId) : undefined;

  return (
    <div className="sticky top-16 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Results & clear */}
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t("coursesFound", { count: totalCourses })}
            </p>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                <X aria-hidden="true" />
                {t("clearFilters")}
              </Button>
            )}
          </div>

          {/* Search, grade & sort */}
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:items-center lg:w-auto">
            <div className="relative col-span-2 sm:flex-1 lg:w-64 lg:flex-none">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label={t("searchPlaceholder")}
                placeholder={t("searchPlaceholder")}
                defaultValue={searchParams?.get("search") || ""}
                className="ps-9"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length > 2 || value.length === 0) {
                    updateSearchParams("search", value);
                  }
                }}
              />
            </div>

            {/* Grade */}
            {grades.length > 0 && (
              <Select
                value={selectedGrade || ALL_GRADES}
                onValueChange={(value) =>
                  updateSearchParams("grade", value === ALL_GRADES ? "" : value)
                }
              >
                <SelectTrigger
                  className="w-full sm:w-[190px]"
                  aria-label={tCatalog("grade")}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <SelectValue placeholder={tCatalog("grade")} />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_GRADES}>{tCatalog("allGrades")}</SelectItem>
                  {myGrade && (
                    <>
                      <SelectSeparator />
                      <SelectItem value={`${myGrade.id}`}>
                        {tCatalog("myGrade", { grade: gradeName(myGrade) })}
                      </SelectItem>
                    </>
                  )}
                  <SelectSeparator />
                  {grades
                    .filter((g) => g.id !== myGrade?.id)
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {gradeName(g)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {/* Sort */}
            <Select
              value={searchParams?.get("sort") || "newest"}
              onValueChange={(value) => updateSearchParams("sort", value)}
            >
              <SelectTrigger
                className={grades.length > 0 ? "w-full sm:w-[180px]" : "col-span-2 w-full sm:w-[180px]"}
                aria-label={t("sortBy")}
              >
                <SelectValue placeholder={t("sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t("newest")}</SelectItem>
                <SelectItem value="popular">{t("mostPopular")}</SelectItem>
                <SelectItem value="rating">{t("highestRated")}</SelectItem>
                <SelectItem value="price-low">{t("priceLowToHigh")}</SelectItem>
                <SelectItem value="price-high">{t("priceHighToLow")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
