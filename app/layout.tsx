import type { Metadata } from "next"
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "react-hot-toast"
import { QueryProvider } from "@/components/providers/query-provider"
import { AuthProvider } from "@/components/providers/auth-provider"
import { SocketProvider } from "@/providers/socket-provider"
import NextTopLoader from "nextjs-toploader"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
})

// IBM Plex Sans Arabic: a modern, highly legible UI face with matching
// Latin glyphs, so mixed Arabic/English strings share one rhythm.
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
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

  const isRTL = locale?.toLowerCase().startsWith("ar")

  return (
    <html lang={locale} dir={isRTL ? "rtl" : "ltr"} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${plexArabic.variable} ${
          isRTL ? "font-arabic" : "font-sans"
        } antialiased`}
      >
        <NextTopLoader
          color="#5046e5"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
        />
        <AuthProvider>
          <QueryProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
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
                        background: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "0.875rem",
                        boxShadow:
                          "0 4px 8px -2px hsl(var(--shadow-color) / 0.06), 0 24px 48px -12px hsl(var(--shadow-color) / 0.22)",
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
