import type { Metadata } from "next"
import { Inter, Cairo } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "react-hot-toast"
import { QueryProvider } from "@/components/providers/query-provider"
import { AuthProvider } from "@/components/providers/auth-provider"
import { SocketProvider } from "@/providers/socket-provider"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
})

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
  preload: false,
})

export const metadata: Metadata = {
  title: {
    default: "E-Learning Platform | منصة التعلم الإلكتروني",
    template: "%s | E-Learning Platform",
  },
  description:
    "منصة تعليمية متكاملة تقدم آلاف الكورسات في البرمجة والتصميم والتسويق والمزيد",
  keywords: [
    "e-learning",
    "online courses",
    "education",
    "programming",
    "design",
    "تعليم",
    "كورسات",
    "دورات تدريبية",
  ],
  authors: [{ name: "E-Learning Platform" }],
  creator: "E-Learning Platform",
  openGraph: {
    type: "website",
    locale: "ar_EG",
    alternateLocale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "E-Learning Platform",
    title: "E-Learning Platform | منصة التعلم الإلكتروني",
    description:
      "منصة تعليمية متكاملة تقدم آلاف الكورسات في البرمجة والتصميم والتسويق والمزيد",
  },
  twitter: {
    card: "summary_large_image",
    title: "E-Learning Platform | منصة التعلم الإلكتروني",
    description:
      "منصة تعليمية متكاملة تقدم آلاف الكورسات في البرمجة والتصميم والتسويق والمزيد",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  const isRTL = locale === "ar"

  return (
    <html lang={locale} dir={isRTL ? "rtl" : "ltr"} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${cairo.variable} ${
          isRTL ? "font-arabic" : "font-sans"
        } antialiased`}
      >
        <AuthProvider>
          <QueryProvider>
            <NextIntlClientProvider messages={messages}>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <SocketProvider>
                  {children}
                  <Toaster
                    position={isRTL ? "top-left" : "top-right"}
                    toastOptions={{
                      duration: 4000,
                      style: {
                        background: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                        border: "1px solid hsl(var(--border))",
                      },
                    }}
                  />
                </SocketProvider>
              </ThemeProvider>
            </NextIntlClientProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
