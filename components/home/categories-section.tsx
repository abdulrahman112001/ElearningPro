"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const categories = [
  { icon: "💻", nameEn: "Programming", nameAr: "البرمجة", slug: "programming", count: 1500 },
  { icon: "🎨", nameEn: "Design", nameAr: "التصميم", slug: "design", count: 800 },
  { icon: "📊", nameEn: "Business", nameAr: "الأعمال", slug: "business", count: 1200 },
  { icon: "📱", nameEn: "Mobile Development", nameAr: "تطوير التطبيقات", slug: "mobile", count: 600 },
  { icon: "🤖", nameEn: "AI & ML", nameAr: "الذكاء الاصطناعي", slug: "ai-ml", count: 400 },
  { icon: "📈", nameEn: "Marketing", nameAr: "التسويق", slug: "marketing", count: 700 },
  { icon: "📸", nameEn: "Photography", nameAr: "التصوير", slug: "photography", count: 300 },
  { icon: "🎵", nameEn: "Music", nameAr: "الموسيقى", slug: "music", count: 250 },
];

export function CategoriesSection() {
  const t = useTranslations();

  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">
              {t("navigation.categories")}
            </h2>
            <p className="text-muted-foreground">
              {t("filter.allCategories")}
            </p>
          </div>
          <Button variant="outline" asChild className="mt-4 md:mt-0">
            <Link href="/categories">
              {t("common.seeAll")}
              <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {categories.map((category, index) => (
            <motion.div
              key={category.slug}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              viewport={{ once: true }}
            >
              <Link
                href={`/courses?category=${category.slug}`}
                className="block p-6 bg-card border rounded-xl hover:border-primary hover:shadow-lg transition-all group card-hover"
              >
                <div className="text-4xl mb-4">{category.icon}</div>
                <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                  {category.nameAr}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {category.count}+ {t("course.courses")}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
