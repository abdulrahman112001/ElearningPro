"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Search, Play, ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function HeroSection() {
  const t = useTranslations()

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-16 md:py-24 lg:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 start-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 end-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center lg:text-start"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              <span className="gradient-text">{t("hero.title")}</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0">
              {t("hero.subtitle")}
            </p>

            {/* Search Box */}
            <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto lg:mx-0 mb-8">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={t("hero.searchPlaceholder")}
                  className="ps-10 h-12 text-base"
                />
              </div>
              <Button size="lg" className="h-12">
                {t("common.search")}
              </Button>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button size="xl" asChild>
                <Link href="/courses">
                  {t("hero.exploreCoures")}
                  <ArrowLeft className="me-2 h-5 w-5 rtl:rotate-180" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/register">
                  <Play className="ms-2 h-5 w-5" />
                  {t("hero.startLearning")}
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative aspect-square max-w-lg mx-auto">
              {/* Decorative elements */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-3xl transform rotate-6" />
              <div className="absolute inset-0 bg-card border rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-8">
                  <div className="aspect-video bg-muted rounded-lg mb-4 flex items-center justify-center">
                    <Play className="h-16 w-16 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="absolute -start-8 top-1/4 bg-card border rounded-xl p-4 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🎓</span>
                  </div>
                  <div>
                    <p className="font-semibold">10K+</p>
                    <p className="text-sm text-muted-foreground">
                      {t("hero.stats.courses")}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="absolute -end-8 bottom-1/4 bg-card border rounded-xl p-4 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-success/10 rounded-full flex items-center justify-center">
                    <span className="text-2xl">👨‍🎓</span>
                  </div>
                  <div>
                    <p className="font-semibold">50K+</p>
                    <p className="text-sm text-muted-foreground">
                      {t("hero.stats.students")}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
