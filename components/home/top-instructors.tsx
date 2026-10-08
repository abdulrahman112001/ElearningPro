"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Star, BookOpen, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/home/section-header";
import { getInitials } from "@/lib/utils";

// Mock data (display text lives in messages under home.topInstructors.items.<key>)
const topInstructors = [
  { id: "1", key: "item1", image: "", totalCourses: 15, totalStudents: 25000, rating: 4.9 },
  { id: "2", key: "item2", image: "", totalCourses: 8, totalStudents: 15000, rating: 4.8 },
  { id: "3", key: "item3", image: "", totalCourses: 12, totalStudents: 18000, rating: 4.7 },
  { id: "4", key: "item4", image: "", totalCourses: 6, totalStudents: 12000, rating: 4.9 },
];

export function TopInstructors() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <SectionHeader
          title={t("navigation.instructors")}
          subtitle={t("home.topInstructors.subtitle")}
          action={{ href: "/instructors", label: t("common.seeAll") }}
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {topInstructors.map((item, index) => {
            const instructor = {
              ...item,
              name: t(`home.topInstructors.items.${item.key}.name`),
              headline: t(`home.topInstructors.items.${item.key}.headline`),
            };
            return (
            <motion.div
              key={instructor.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Link href={`/instructors/${instructor.id}`}>
                <Card className="text-center card-hover group rounded-lg hover:border-primary/30">
                  <CardContent className="p-6">
                    <div className="relative mx-auto mb-4 h-24 w-24">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 opacity-0 blur-md transition-opacity group-hover:opacity-40" />
                      <Avatar className="relative h-24 w-24 ring-4 ring-primary/10">
                        <AvatarImage src={instructor.image} />
                        <AvatarFallback className="text-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                          {getInitials(instructor.name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                      {instructor.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {instructor.headline}
                    </p>
                    <div className="flex items-center justify-center gap-1 mb-4">
                      <Star className="h-4 w-4 star-filled fill-current" />
                      <span className="font-semibold">{instructor.rating}</span>
                    </div>
                    <div className="flex justify-center gap-6 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        {instructor.totalCourses}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {instructor.totalStudents.toLocaleString(
                          locale === "ar" ? "ar-EG" : "en-US"
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
