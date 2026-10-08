import { StaticPage, staticPageMetadata } from "@/components/layout/static-page"

export const generateMetadata = () => staticPageMetadata("faq")

export default function FaqPage() {
  return <StaticPage page="faq" sections={["s1","s2","s3","s4","s5","s6"]} />
}
