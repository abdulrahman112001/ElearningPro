"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CoursesFilterProps {
  totalCourses: number;
}

export function CoursesFilter({ totalCourses }: CoursesFilterProps) {
  const t = useTranslations("courses");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateSearchParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // Reset page when filters change
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push(pathname);
  };

  const hasFilters = 
    searchParams.get("category") ||
    searchParams.get("level") ||
    searchParams.get("price") ||
    searchParams.get("search");

  return (
    <div className="border-b bg-background sticky top-16 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Left Side - Results & Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {totalCourses} {t("coursesFound")}
            </p>
            
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 ml-1" />
                {t("clearFilters")}
              </Button>
            )}
          </div>

          {/* Right Side - Sort & View */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-64">
              <Input
                placeholder={t("searchPlaceholder")}
                defaultValue={searchParams.get("search") || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length > 2 || value.length === 0) {
                    updateSearchParams("search", value);
                  }
                }}
              />
            </div>

            {/* Sort */}
            <Select
              value={searchParams.get("sort") || "newest"}
              onValueChange={(value) => updateSearchParams("sort", value)}
            >
              <SelectTrigger className="w-[180px]">
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
