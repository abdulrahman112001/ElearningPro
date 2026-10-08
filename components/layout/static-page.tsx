import Link from "next/link"
import { getTranslations } from "next-intl/server"

export type StaticPageKey = "about" | "help" | "faq" | "terms" | "privacy"

/**
 * Text-only content page (about, help, FAQ, legal). All copy lives in
 * messages/*.json under `staticPages.<page>`: title, intro and sections
 * s1..sN, each with a heading and a body.
 */
export async function StaticPage({ page, sections }: { page: StaticPageKey; sections: string[] }) {
  const t = await getTranslations(`staticPages.${page}`)
  const common = await getTranslations("staticPages")

  return (
    <div className="container max-w-3xl py-10 md:py-16">
      <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{t("intro")}</p>

      <div className="mt-10 space-y-8">
        {sections.map((id) => (
          <section key={id} aria-labelledby={`${page}-${id}`}>
            <h2 id={`${page}-${id}`} className="text-xl font-semibold">
              {t(`sections.${id}.heading`)}
            </h2>
            <p className="mt-2 leading-relaxed text-muted-foreground whitespace-pre-line">
              {t(`sections.${id}.body`)}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-lg border bg-muted/40 p-6">
        <p className="font-medium">{common("stillHaveQuestions")}</p>
        <Link href="/contact" className="mt-2 inline-block text-primary hover:underline">
          {common("contactUs")}
        </Link>
      </div>
    </div>
  )
}

export async function staticPageMetadata(page: StaticPageKey) {
  const t = await getTranslations(`staticPages.${page}`)
  return { title: t("title"), description: t("intro") }
}
