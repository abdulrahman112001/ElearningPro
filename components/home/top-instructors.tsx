"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowLeft, Star, BookOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
        <div className="flex flex-col md:flex-row justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">
              {t("navigation.instructors")}
            </h2>
            <p className="text-muted-foreground">
              تعلم من أفضل الخبراء في مجالاتهم
            </p>
          </div>
          <Button variant="outline" asChild className="mt-4 md:mt-0">
            <Link href="/instructors">
              {t("common.seeAll")}
              <ArrowLeft className="mr-2 h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {topInstructors.map((instructor, index) => (
            <motion.div
              key={instructor.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Link href={`/instructor/${instructor.id}`}>
                <Card className="text-center card-hover group">
                  <CardContent className="p-6">
                    <Avatar className="h-24 w-24 mx-auto mb-4 ring-4 ring-primary/10">
                      <AvatarImage src={instructor.image} />
                      <AvatarFallback className="text-2xl">
                        {getInitials(instructor.name)}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                      {instructor.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {instructor.headline}
                    </p>
                    <div className="flex items-center justify-center gap-1 mb-4">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
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
