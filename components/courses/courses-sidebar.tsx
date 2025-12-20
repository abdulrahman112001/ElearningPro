"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Star } from "lucide-react";

interface Category {
  id: string;
  name: string;
  nameAr: string;
  children: Category[];
  _count: {
    courses: number;
  };
}

interface CoursesSidebarProps {
  categories: Category[];
}

export function CoursesSidebar({ categories }: CoursesSidebarProps) {
  const t = useTranslations("courses");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateSearchParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const selectedCategory = searchParams.get("category") || "";
  const selectedLevel = searchParams.get("level") || "";
  const selectedPrice = searchParams.get("price") || "";
  const selectedRating = searchParams.get("rating") || "";
  const selectedDuration = searchParams.get("duration") || "";

  return (
    <div className="bg-background rounded-lg border p-4 sticky top-32">
      <h3 className="font-semibold mb-4">{t("filters")}</h3>
      
      <Accordion type="multiple" defaultValue={["category", "level", "price", "rating"]}>
        {/* Categories */}
        <AccordionItem value="category">
          <AccordionTrigger className="text-sm font-medium">
            {t("category")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <div
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                  !selectedCategory ? "bg-primary/10 text-primary" : ""
                }`}
                onClick={() => updateSearchParams("category", "")}
              >
                <span className="text-sm">{t("allCategories")}</span>
              </div>
              {categories.map((category) => (
                <div key={category.id}>
                  <div
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                      selectedCategory === category.id ? "bg-primary/10 text-primary" : ""
                    }`}
                    onClick={() => updateSearchParams("category", category.id)}
                  >
                    <span className="text-sm">{category.nameAr || category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {category._count.courses}
                    </span>
                  </div>
                  {category.children.length > 0 && selectedCategory === category.id && (
                    <div className="mr-4 mt-1 space-y-1">
                      {category.children.map((child) => (
                        <div
                          key={child.id}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-muted transition-colors text-sm ${
                            selectedCategory === child.id ? "bg-primary/10 text-primary" : ""
                          }`}
                          onClick={() => updateSearchParams("category", child.id)}
                        >
                          <span>{child.nameAr || child.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <Separator />

        {/* Level */}
        <AccordionItem value="level">
          <AccordionTrigger className="text-sm font-medium">
            {t("level")}
          </AccordionTrigger>
          <AccordionContent>
            <RadioGroup
              value={selectedLevel}
              onValueChange={(value) => updateSearchParams("level", value)}
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="" id="level-all" />
                <Label htmlFor="level-all" className="text-sm cursor-pointer">
                  {t("allLevels")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="BEGINNER" id="level-beginner" />
                <Label htmlFor="level-beginner" className="text-sm cursor-pointer">
                  {t("beginner")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="INTERMEDIATE" id="level-intermediate" />
                <Label htmlFor="level-intermediate" className="text-sm cursor-pointer">
                  {t("intermediate")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="ADVANCED" id="level-advanced" />
                <Label htmlFor="level-advanced" className="text-sm cursor-pointer">
                  {t("advanced")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="ALL_LEVELS" id="level-all-levels" />
                <Label htmlFor="level-all-levels" className="text-sm cursor-pointer">
                  {t("allLevels")}
                </Label>
              </div>
            </RadioGroup>
          </AccordionContent>
        </AccordionItem>

        <Separator />

        {/* Price */}
        <AccordionItem value="price">
          <AccordionTrigger className="text-sm font-medium">
            {t("price")}
          </AccordionTrigger>
          <AccordionContent>
            <RadioGroup
              value={selectedPrice}
              onValueChange={(value) => updateSearchParams("price", value)}
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="" id="price-all" />
                <Label htmlFor="price-all" className="text-sm cursor-pointer">
                  {t("allPrices")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="free" id="price-free" />
                <Label htmlFor="price-free" className="text-sm cursor-pointer">
                  {t("free")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="paid" id="price-paid" />
                <Label htmlFor="price-paid" className="text-sm cursor-pointer">
                  {t("paid")}
                </Label>
              </div>
            </RadioGroup>
          </AccordionContent>
        </AccordionItem>

        <Separator />

        {/* Rating */}
        <AccordionItem value="rating">
          <AccordionTrigger className="text-sm font-medium">
            {t("rating")}
          </AccordionTrigger>
          <AccordionContent>
            <RadioGroup
              value={selectedRating}
              onValueChange={(value) => updateSearchParams("rating", value)}
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="" id="rating-all" />
                <Label htmlFor="rating-all" className="text-sm cursor-pointer">
                  {t("allRatings")}
                </Label>
              </div>
              {[4.5, 4, 3.5, 3].map((rating) => (
                <div key={rating} className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value={rating.toString()} id={`rating-${rating}`} />
                  <Label htmlFor={`rating-${rating}`} className="text-sm cursor-pointer flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    {rating} {t("andAbove")}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </AccordionContent>
        </AccordionItem>

        <Separator />

        {/* Duration */}
        <AccordionItem value="duration">
          <AccordionTrigger className="text-sm font-medium">
            {t("duration")}
          </AccordionTrigger>
          <AccordionContent>
            <RadioGroup
              value={selectedDuration}
              onValueChange={(value) => updateSearchParams("duration", value)}
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="" id="duration-all" />
                <Label htmlFor="duration-all" className="text-sm cursor-pointer">
                  {t("allDurations")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="short" id="duration-short" />
                <Label htmlFor="duration-short" className="text-sm cursor-pointer">
                  0-2 {t("hours")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="medium" id="duration-medium" />
                <Label htmlFor="duration-medium" className="text-sm cursor-pointer">
                  2-10 {t("hours")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="long" id="duration-long" />
                <Label htmlFor="duration-long" className="text-sm cursor-pointer">
                  10+ {t("hours")}
                </Label>
              </div>
            </RadioGroup>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
