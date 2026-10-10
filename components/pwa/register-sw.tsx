"use client"

import { useEffect } from "react"

/**
 * Registers /sw.js in production builds only, on https or localhost
 * (service workers need a secure context). In development an old worker
 * is unregistered so it can't serve stale bundles.
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.active?.scriptURL.endsWith("/sw.js") && r.unregister()))
        .catch(() => {})
      return
    }

    const { protocol, hostname } = window.location
    const secure = protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1"
    if (!secure) return

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.warn("[pwa] service worker registration failed", error)
      })
    }
    if (document.readyState === "complete") register()
    else {
      window.addEventListener("load", register, { once: true })
      return () => window.removeEventListener("load", register)
    }
  }, [])

  return null
}
