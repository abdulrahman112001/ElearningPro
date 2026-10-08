"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
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
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-8 text-center text-white md:p-16"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 -z-0">
            <div className="absolute top-0 start-1/4 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 end-1/4 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
              <span>{t("home.cta.badge")}</span>
            </div>

            <h2 className="mx-auto mb-6 max-w-3xl text-3xl font-bold md:text-5xl">
              {t("home.cta.title")}
            </h2>

            <p className="mx-auto mb-8 max-w-2xl text-lg text-white/80 md:text-xl">
              {t("home.cta.subtitle")}
            </p>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="xl" variant="secondary" className="shadow-elevated" asChild>
                <Link href="/register">
                  {t("auth.register")}
                  <ArrowRight className="h-5 w-5 rtl:rotate-180" />
                </Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="border-white bg-transparent text-white hover:bg-white hover:text-primary"
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
