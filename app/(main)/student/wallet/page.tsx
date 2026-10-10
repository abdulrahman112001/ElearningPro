import { Suspense } from "react"
import { WalletView } from "@/components/wallet/wallet-view"

export const dynamic = "force-dynamic"

export default function StudentWalletPage() {
  return (
    <Suspense>
      <WalletView />
    </Suspense>
  )
}
