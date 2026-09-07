"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Star, BookOpen, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/home/section-header";
import { getInitials } from "@/lib/utils";

// Mock data
const topInstructors = [
  {
    id: "1",
    name: "أحمد محمد",
    headline: "مطور ويب محترف",
    image: "",
    totalCourses: 15,
    totalStudents: 25000,
    rating: 4.9,
  },
  {
    id: "2",
    name: "سارة أحمد",
    headline: "خبيرة React و Next.js",
    image: "",
    totalCourses: 8,
    totalStudents: 15000,
    rating: 4.8,
  },
  {
    id: "3",
    name: "محمد علي",
    headline: "مصمم UI/UX",
    image: "",
    totalCourses: 12,
    totalStudents: 18000,
    rating: 4.7,
  },
  {
    id: "4",
    name: "خالد إبراهيم",
    headline: "خبير ذكاء اصطناعي",
    image: "",
    totalCourses: 6,
    totalStudents: 12000,
    rating: 4.9,
  },
];

export function TopInstructors() {
  const t = useTranslations();

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <SectionHeader
          title={t("navigation.instructors")}
          subtitle={t("home.topInstructors.subtitle")}
          action={{ href: "/instructors", label: t("common.seeAll") }}
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {topInstructors.map((instructor, index) => (
            <motion.div
              key={instructor.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Link href={`/instructors/${instructor.id}`}>
                <Card className="text-center card-hover group rounded-2xl border-2 hover:border-primary/40">
                  <CardContent className="p-6">
                    <div className="relative mx-auto mb-4 h-24 w-24">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 opacity-0 blur-md transition-opacity group-hover:opacity-40" />
                      <Avatar className="relative h-24 w-24 ring-4 ring-primary/10">
                        <AvatarImage src={instructor.image} />
                        <AvatarFallback className="text-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
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
                        {instructor.totalStudents.toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
