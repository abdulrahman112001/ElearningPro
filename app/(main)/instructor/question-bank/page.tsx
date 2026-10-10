import { getTranslations } from "next-intl/server"
import { QuestionBankManager } from "@/components/exams/question-bank-manager"

export async function generateMetadata() {
  const t = await getTranslations("exams")
  return { title: t("bank.title") }
}

export default function InstructorQuestionBankPage() {
  return <QuestionBankManager />
}
