import type { InstructorApplicationStatus, InstructorProfile } from "@prisma/client"

/** Highest education level a teacher can declare on the application. */
export const QUALIFICATIONS = ["diploma", "bachelor", "education_diploma", "master", "phd", "other"] as const
export const GENDERS = ["male", "female"] as const

/** Profile columns the application form reads and writes. */
export const APPLICATION_SELECT = {
  isApproved: true,
  applicationStatus: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  phone: true,
  whatsapp: true,
  gender: true,
  governorate: true,
  city: true,
  specialization: true,
  subjects: true,
  gradeLevelIds: true,
  qualification: true,
  university: true,
  graduationYear: true,
  yearsOfExperience: true,
  currentWorkplace: true,
  cvUrl: true,
  introVideoUrl: true,
  facebook: true,
  agreedToTermsAt: true,
} as const

/**
 * The status shown to people. isApproved is the source of truth for access,
 * so instructors approved before applications existed read as APPROVED.
 */
export function effectiveApplicationStatus(
  profile: Pick<InstructorProfile, "isApproved" | "applicationStatus"> | null | undefined
): InstructorApplicationStatus {
  if (!profile) return "DRAFT"
  if (profile.isApproved) return "APPROVED"
  return profile.applicationStatus === "APPROVED" ? "PENDING" : profile.applicationStatus
}

type FieldError = { field: string; code: string }

const PHONE_RE = /^\+?[0-9\s-]{8,20}$/
const URL_RE = /^https?:\/\/\S+$/i

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

export interface ApplicationInput {
  name: string
  headline: string
  bio: string
  linkedin: string | null
  youtube: string | null
  profile: {
    phone: string
    whatsapp: string | null
    gender: string
    governorate: string
    city: string | null
    specialization: string
    subjects: string[]
    gradeLevelIds: string[]
    qualification: string
    university: string
    graduationYear: number | null
    yearsOfExperience: number
    currentWorkplace: string | null
    cvUrl: string | null
    introVideoUrl: string | null
    facebook: string | null
  }
}

/** Validates a submitted application. Returns the clean input or field errors. */
export function parseApplication(
  body: Record<string, unknown>
): { data: ApplicationInput; errors?: undefined } | { data?: undefined; errors: FieldError[] } {
  const errors: FieldError[] = []
  const required = (field: string, value: string | null) => {
    if (!value) errors.push({ field, code: "required" })
    return value ?? ""
  }

  const name = required("name", str(body.name, 100))
  const headline = required("headline", str(body.headline, 120))
  const bio = required("bio", str(body.bio, 3000))
  if (bio && bio.length < 50) errors.push({ field: "bio", code: "too_short" })

  const phone = required("phone", str(body.phone, 20))
  if (phone && !PHONE_RE.test(phone)) errors.push({ field: "phone", code: "invalid" })
  const whatsapp = str(body.whatsapp, 20)
  if (whatsapp && !PHONE_RE.test(whatsapp)) errors.push({ field: "whatsapp", code: "invalid" })

  const gender = required("gender", str(body.gender, 10))
  if (gender && !(GENDERS as readonly string[]).includes(gender)) errors.push({ field: "gender", code: "invalid" })

  const governorate = required("governorate", str(body.governorate, 60))
  const city = str(body.city, 60)
  const specialization = required("specialization", str(body.specialization, 80))

  const subjects = Array.isArray(body.subjects)
    ? Array.from(new Set(body.subjects.map((s) => str(s, 60)).filter((s): s is string => !!s))).slice(0, 10)
    : []
  const gradeLevelIds = Array.isArray(body.gradeLevelIds)
    ? Array.from(new Set(body.gradeLevelIds.filter((s): s is string => typeof s === "string" && !!s))).slice(0, 20)
    : []

  const qualification = required("qualification", str(body.qualification, 30))
  if (qualification && !(QUALIFICATIONS as readonly string[]).includes(qualification)) {
    errors.push({ field: "qualification", code: "invalid" })
  }
  const university = required("university", str(body.university, 120))

  const thisYear = new Date().getFullYear()
  let graduationYear: number | null = null
  if (body.graduationYear !== undefined && body.graduationYear !== null && body.graduationYear !== "") {
    const y = Number(body.graduationYear)
    if (!Number.isInteger(y) || y < 1950 || y > thisYear) errors.push({ field: "graduationYear", code: "invalid" })
    else graduationYear = y
  }

  const years = Number(body.yearsOfExperience)
  if (body.yearsOfExperience === undefined || body.yearsOfExperience === null || body.yearsOfExperience === "") {
    errors.push({ field: "yearsOfExperience", code: "required" })
  } else if (!Number.isInteger(years) || years < 0 || years > 60) {
    errors.push({ field: "yearsOfExperience", code: "invalid" })
  }

  const currentWorkplace = str(body.currentWorkplace, 120)
  const urls: Record<string, string | null> = {}
  for (const field of ["cvUrl", "introVideoUrl", "facebook", "linkedin", "youtube"]) {
    const v = str(body[field], 500)
    if (v && !URL_RE.test(v)) errors.push({ field, code: "invalid_url" })
    urls[field] = v
  }

  if (body.agreeTerms !== true) errors.push({ field: "agreeTerms", code: "required" })

  if (errors.length) return { errors }
  return {
    data: {
      name,
      headline,
      bio,
      linkedin: urls.linkedin,
      youtube: urls.youtube,
      profile: {
        phone,
        whatsapp,
        gender,
        governorate,
        city,
        specialization,
        subjects,
        gradeLevelIds,
        qualification,
        university,
        graduationYear,
        yearsOfExperience: years,
        currentWorkplace,
        cvUrl: urls.cvUrl,
        introVideoUrl: urls.introVideoUrl,
        facebook: urls.facebook,
      },
    },
  }
}
