import type { MetadataRoute } from "next"

const THEME_COLOR = "#4f46e5"

/** Web app manifest: makes the platform installable as a mobile app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "E-Learn",
    short_name: "E-Learn",
    description: "منصة تعليمية متكاملة: كورسات، اختبارات، واجبات ومتابعة مستمرة مع معلمك في أي وقت ومن أي مكان",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: THEME_COLOR,
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "لوحة الطالب", short_name: "لوحتي", url: "/student", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "إنجازاتي", short_name: "إنجازاتي", url: "/student/achievements", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
