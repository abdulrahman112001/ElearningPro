/**
 * Egypt's 27 governorates. The English name is what gets stored on the
 * profile; `key` is the translation key under instructorApplication.governorates.
 */
export const GOVERNORATES = [
  "Cairo",
  "Giza",
  "Alexandria",
  "Qalyubia",
  "Dakahlia",
  "Sharqia",
  "Gharbia",
  "Monufia",
  "Beheira",
  "Kafr El Sheikh",
  "Damietta",
  "Port Said",
  "Ismailia",
  "Suez",
  "North Sinai",
  "South Sinai",
  "Red Sea",
  "Matrouh",
  "New Valley",
  "Faiyum",
  "Beni Suef",
  "Minya",
  "Asyut",
  "Sohag",
  "Qena",
  "Luxor",
  "Aswan",
] as const

export type Governorate = (typeof GOVERNORATES)[number]

/** Translation key for a governorate name ("Kafr El Sheikh" -> "KafrElSheikh"). */
export const governorateKey = (name: string) => name.replace(/\s+/g, "")

export const GRADE_STAGES = ["primary", "preparatory", "secondary", "university", "other"] as const

export const MAX_SUBJECTS = 10
export const BIO_MIN = 50
export const BIO_MAX = 3000

export const PHONE_RE = /^\+?[0-9\s-]{8,20}$/
export const URL_RE = /^https?:\/\/\S+$/i

export type ApplicationStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"

export interface GradeLevelOption {
  id: string
  nameAr: string
  nameEn: string
  stage: string | null
  position: number
}

export interface ApplicationRecord {
  isApproved: boolean
  applicationStatus: ApplicationStatus
  submittedAt: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  phone: string | null
  whatsapp: string | null
  gender: string | null
  governorate: string | null
  city: string | null
  specialization: string | null
  subjects: string[]
  gradeLevelIds: string[]
  qualification: string | null
  university: string | null
  graduationYear: number | null
  yearsOfExperience: number | null
  currentWorkplace: string | null
  cvUrl: string | null
  introVideoUrl: string | null
  facebook: string | null
  agreedToTermsAt: string | null
}

export interface ApplicationResponse {
  status: ApplicationStatus
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    headline: string | null
    bio: string | null
    linkedin: string | null
    youtube: string | null
  }
  application: ApplicationRecord | null
}
