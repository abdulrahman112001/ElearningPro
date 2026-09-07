"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/home/section-header";
import { getInitials } from "@/lib/utils";

const testimonials = [
  {
    id: "1",
    name: "محمد أحمد",
    role: "مطور ويب",
    image: "",
    rating: 5,
    content:
      "منصة رائعة جداً! تعلمت منها الكثير وتمكنت من الحصول على وظيفة أحلامي بفضل الكورسات الموجودة هنا.",
  },
  {
    id: "2",
    name: "فاطمة علي",
    role: "مصممة جرافيك",
    image: "",
    rating: 5,
    content:
      "الكورسات منظمة بشكل ممتاز والمدربين محترفين. أنصح بها بشدة لكل من يريد تطوير مهاراته.",
  },
  {
    id: "3",
    name: "أحمد خالد",
    role: "طالب جامعي",
    image: "",
    rating: 5,
    content:
      "أفضل منصة تعليمية استخدمتها! المحتوى عالي الجودة والأسعار مناسبة جداً.",
  },
];

export function TestimonialsSection() {
  const t = useTranslations();

  return (
    <section className="bg-muted/30 py-16 md:py-24">
      <div className="container">
        <SectionHeader
          align="center"
          eyebrow={t("home.testimonials.badge")}
          title={t("home.testimonials.title")}
          subtitle={t("home.testimonials.subtitle")}
        />

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="card-hover h-full rounded-2xl border-transparent bg-card shadow-sm">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Quote className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mb-6 text-muted-foreground">
                    {testimonial.content}
                  </p>
                  <div className="mb-4 flex items-center gap-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="star-filled h-4 w-4 fill-current"
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar className="ring-2 ring-primary/10">
                      <AvatarImage src={testimonial.image} />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
                        {getInitials(testimonial.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
