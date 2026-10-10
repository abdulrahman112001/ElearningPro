"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import { Ticket } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RedeemCodeForm, type RedeemResult } from "./redeem-code-form"

export interface RedeemCodeDialogProps {
  onRedeemed?: (result: RedeemResult) => void
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
  className?: string
  label?: React.ReactNode
}

/** "Have a code?" link-button that opens the redeem form in a dialog. */
export function RedeemCodeDialog({ onRedeemed, size = "sm", variant = "ghost", className, label }: RedeemCodeDialogProps) {
  const t = useTranslations("accessCodes")
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  const openDialog = () => {
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`)
      return
    }
    setOpen(true)
  }

  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} onClick={openDialog}>
        <Ticket aria-hidden="true" />
        {label ?? t("haveCode")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("redeemTitle")}</DialogTitle>
            <DialogDescription>{t("redeemDescription")}</DialogDescription>
          </DialogHeader>
          <RedeemCodeForm
            autoFocus
            onRedeemed={(r) => {
              onRedeemed?.(r)
              if (r.type !== "WALLET") setOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
