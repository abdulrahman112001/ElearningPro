"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { SectionHeader } from "@/components/home/section-header";

// Category names are translated via home.categoriesSection.items.<key>
const categories = [
  { icon: "💻", key: "programming", slug: "programming", count: 1500 },
  { icon: "🎨", key: "design", slug: "design", count: 800 },
  { icon: "📊", key: "business", slug: "business", count: 1200 },
  { icon: "📱", key: "mobile", slug: "mobile", count: 600 },
  { icon: "🤖", key: "aiMl", slug: "ai-ml", count: 400 },
  { icon: "📈", key: "marketing", slug: "marketing", count: 700 },
  { icon: "📸", key: "photography", slug: "photography", count: 300 },
  { icon: "🎵", key: "music", slug: "music", count: 250 },
];

export function CategoriesSection() {
  const t = useTranslations();

  return (
    <section className="bg-muted/30 py-16 md:py-24">
      <div className="container">
        <SectionHeader
          eyebrow={t("navigation.categories")}
          title={t("filter.allCategories")}
          action={{ href: "/categories", label: t("common.seeAll") }}
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {categories.map((category, index) => (
            <motion.div
              key={category.slug}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              viewport={{ once: true }}
            >
              <Link
                href={`/courses?category=${category.slug}`}
                className="card-hover group flex items-center gap-4 rounded-2xl border-2 bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-2xl transition-colors group-hover:bg-primary/12">
                  {category.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold transition-colors group-hover:text-primary">
                    {t(`home.categoriesSection.items.${category.key}`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {category.count}+ {t("course.courses")}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
