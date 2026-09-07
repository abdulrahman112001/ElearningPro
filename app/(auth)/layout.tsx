import { GraduationCap } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations()

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left Side - Auth Form */}
      <div className="order-1 flex items-center justify-center bg-background p-6 lg:order-none lg:p-12">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Right Side - Branding */}
      <div className="bg-mesh-brand relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 p-12 text-white lg:flex">
        <div className="absolute inset-0 -z-0">
          <div className="absolute -top-24 -end-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -start-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        </div>

        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="text-2xl font-bold">E-Learn</span>
        </Link>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            {t("auth.brandTitle")}
          </h1>
          <p className="max-w-md text-lg text-white/80">
            {t("auth.brandSubtitle")}
          </p>
          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-3xl font-bold">10K+</p>
              <p className="text-white/70">{t("hero.stats.courses")}</p>
            </div>
            <div>
              <p className="text-3xl font-bold">50K+</p>
              <p className="text-white/70">{t("hero.stats.students")}</p>
            </div>
            <div>
              <p className="text-3xl font-bold">5K+</p>
              <p className="text-white/70">{t("hero.stats.instructors")}</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-sm text-white/60">
          &copy; {new Date().getFullYear()} E-Learn. {t("footer.allRightsReserved")}
        </p>
      </div>
    </div>
  )
}
