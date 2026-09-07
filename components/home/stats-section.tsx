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
    <section className="relative border-y bg-card py-10 md:py-12">
      <div className="container">
        <div className="grid grid-cols-2 gap-y-8 md:grid-cols-4 md:gap-x-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="flex flex-col items-center gap-3 text-center md:flex-row md:text-start"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 shadow-sm">
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-extrabold tracking-tight md:text-3xl">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{t(stat.key)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
