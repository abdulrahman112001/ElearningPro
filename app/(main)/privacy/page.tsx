import { StaticPage, staticPageMetadata } from "@/components/layout/static-page"

export const generateMetadata = () => staticPageMetadata("privacy")

export default function PrivacyPage() {
  return <StaticPage page="privacy" sections={["s1","s2","s3","s4","s5","s6"]} />
}
