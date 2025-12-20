"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Users, BookOpen, Award, GraduationCap } from "lucide-react";

const stats = [
  { icon: Users, value: "50,000+", key: "students" },
  { icon: BookOpen, value: "10,000+", key: "courses" },
  { icon: GraduationCap, value: "5,000+", key: "instructors" },
  { icon: Award, value: "100,000+", key: "certificates" },
];

export function StatsSection() {
  const t = useTranslations("hero.stats");

  return (
    <section className="py-12 border-y bg-muted/30">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="flex justify-center mb-3">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-7 w-7 text-primary" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-bold">{stat.value}</p>
              <p className="text-muted-foreground">{t(stat.key)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
