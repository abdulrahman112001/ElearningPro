"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            ماذا يقول طلابنا
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            آراء حقيقية من طلاب حققوا أهدافهم من خلال منصتنا
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full">
                <CardContent className="p-6">
                  <Quote className="h-10 w-10 text-primary/20 mb-4" />
                  <p className="text-muted-foreground mb-6">
                    {testimonial.content}
                  </p>
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={testimonial.image} />
                      <AvatarFallback>
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
