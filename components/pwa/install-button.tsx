"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Download, Share, PlusSquare } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as Mac; touch points tell them apart.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * "Install the app" button. Uses `beforeinstallprompt` where supported
 * (Android / desktop Chromium); on iOS Safari it explains Share → Add to
 * Home Screen. Renders nothing when already installed or not installable.
 */
export function InstallButton({
  className,
  variant = "outline",
  size = "sm",
}: {
  className?: string
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
}) {
  const t = useTranslations("pwa")
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [installed, setInstalled] = useState(true)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())
    setIos(isIos())
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (installed || (!deferred && !ios)) return null

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice.catch(() => null)
      if (choice?.outcome === "accepted") setInstalled(true)
      setDeferred(null)
    } else if (ios) {
      setShowIosHelp(true)
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={onClick}>
        <Download className="me-2 h-4 w-4" aria-hidden="true" />
        {t("install")}
      </Button>
      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("iosTitle")}</DialogTitle>
            <DialogDescription>{t("iosDescription")}</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Share className="h-4 w-4" aria-hidden="true" />
              </span>
              {t("iosStep1")}
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PlusSquare className="h-4 w-4" aria-hidden="true" />
              </span>
              {t("iosStep2")}
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  )
}
