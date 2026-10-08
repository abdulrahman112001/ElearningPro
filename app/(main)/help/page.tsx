import { StaticPage, staticPageMetadata } from "@/components/layout/static-page"

export const generateMetadata = () => staticPageMetadata("help")

export default function HelpPage() {
  return <StaticPage page="help" sections={["s1","s2","s3","s4"]} />
}
