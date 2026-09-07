"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Search, Play, ArrowLeft, Sparkles, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function HeroSection() {
  const t = useTranslations()

  return (
    <section className="bg-mesh-brand relative overflow-hidden py-20 md:py-28 lg:py-36">
      {/* Fade the mesh out toward the bottom so it reads as a subtle backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/30 via-background/90 to-background" />

      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center lg:text-start"
          >
            <div className="eyebrow mx-auto mb-6 lg:mx-0">
              <Sparkles className="h-4 w-4" />
              <span>{t("hero.badge")}</span>
            </div>

            <h1 className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
              <span className="gradient-text">{t("hero.title")}</span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl lg:mx-0">
              {t("hero.subtitle")}
            </p>

            {/* Search Box */}
            <div className="mx-auto mb-8 flex max-w-xl flex-col gap-3 sm:flex-row lg:mx-0">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("hero.searchPlaceholder")}
                  className="h-12 rounded-xl ps-10 text-base shadow-sm"
                />
              </div>
              <Button size="lg" variant="gradient" className="h-12 rounded-xl">
                {t("common.search")}
              </Button>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Button size="xl" variant="gradient" className="shadow-glow-lg" asChild>
                <Link href="/courses">
                  {t("hero.exploreCoures")}
                  <ArrowLeft className="me-2 h-5 w-5 rtl:rotate-180" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="border-2" asChild>
                <Link href="/register">
                  <Play className="ms-2 h-5 w-5" />
                  {t("hero.startLearning")}
                </Link>
              </Button>
            </div>

            {/* Social proof strip */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
              <div className="flex -space-x-3 rtl:space-x-reverse">
                {["🎓", "👩‍💻", "👨‍🏫", "👩‍🎓"].map((emoji, i) => (
                  <div
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm shadow-sm"
                  >
                    {emoji}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="star-filled h-4 w-4 fill-current" />
                  ))}
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  4.9/5 &middot; 50K+ {t("hero.stats.students")}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative mx-auto aspect-square max-w-lg">
              {/* Decorative gradient backdrop */}
              <div className="absolute inset-0 rotate-6 rounded-[2rem] bg-gradient-to-br from-indigo-500/30 via-violet-500/20 to-fuchsia-500/30 blur-sm" />
              <div className="glass-card absolute inset-0 overflow-hidden rounded-[2rem] shadow-glow-lg">
                <div className="p-8">
                  <div className="mb-4 flex aspect-video items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
                      <Play className="h-8 w-8 fill-white text-white" />
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div className="h-4 w-3/4 rounded-full bg-muted" />
                    <div className="h-4 w-1/2 rounded-full bg-muted" />
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="glass-card absolute -start-8 top-1/4 rounded-xl p-4 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
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
                className="glass-card absolute -end-8 bottom-1/4 rounded-xl p-4 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
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
