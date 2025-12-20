import { GraduationCap } from "lucide-react"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary to-primary/80 text-white p-12">
        <Link href="/" className="flex items-center gap-2">
          <GraduationCap className="h-10 w-10" />
          <span className="text-2xl font-bold">E-Learn</span>
        </Link>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold">ابدأ رحلة التعلم اليوم</h1>
          <p className="text-lg text-white/80 max-w-md">
            انضم لآلاف الطلاب الذين يتعلمون مهارات جديدة من أفضل المدربين في
            العالم العربي
          </p>
          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-3xl font-bold">10K+</p>
              <p className="text-white/70">كورس</p>
            </div>
            <div>
              <p className="text-3xl font-bold">50K+</p>
              <p className="text-white/70">طالب</p>
            </div>
            <div>
              <p className="text-3xl font-bold">5K+</p>
              <p className="text-white/70">معلم</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-white/60">
          © {new Date().getFullYear()} E-Learn. جميع الحقوق محفوظة
        </p>
      </div>

      {/* Right Side - Auth Form */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
