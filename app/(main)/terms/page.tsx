import { StaticPage, staticPageMetadata } from "@/components/layout/static-page"

export const generateMetadata = () => staticPageMetadata("terms")

export default function TermsPage() {
  return <StaticPage page="terms" sections={["s1","s2","s3","s4","s5","s6"]} />
}
