"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CTASection() {
  const t = useTranslations()

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 dark:from-primary-foreground dark:to-primary-foreground/90 p-8 md:p-16 text-center text-white"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 -z-0">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 mb-6">
              <Sparkles className="h-5 w-5" />
              <span>ابدأ رحلة التعلم اليوم</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-bold mb-6 max-w-3xl mx-auto">
              انضم لآلاف الطلاب الذين يتعلمون مهارات جديدة كل يوم
            </h2>

            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              سجل الآن واحصل على وصول غير محدود لآلاف الكورسات في مختلف المجالات
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" variant="secondary" asChild>
                <Link href="/register">
                  {t("auth.register")}
                  <ArrowLeft className="mr-2 h-5 w-5 rtl:rotate-180" />
                </Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
                asChild
              >
                <Link href="/courses">{t("hero.exploreCoures")}</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
