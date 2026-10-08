import { StaticPage, staticPageMetadata } from "@/components/layout/static-page"

export const generateMetadata = () => staticPageMetadata("about")

export default function AboutPage() {
  return <StaticPage page="about" sections={["s1","s2","s3","s4"]} />
}
