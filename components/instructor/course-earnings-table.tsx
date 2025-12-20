"use client"

import { useTranslations, useLocale } from "next-intl"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface CourseEarning {
  id: string
  titleEn: string
  titleAr: string | null
  students: number
  revenue: number
  earnings: number
}

interface CourseEarningsTableProps {
  courses: CourseEarning[]
}

export function CourseEarningsTable({ courses }: CourseEarningsTableProps) {
  const t = useTranslations("instructor")
  const locale = useLocale()

  if (courses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>{t("noCourses")}</p>
      </div>
    )
  }

  const totalRevenue = courses.reduce((sum, c) => sum + c.revenue, 0)
  const totalEarnings = courses.reduce((sum, c) => sum + c.earnings, 0)
  const totalStudents = courses.reduce((sum, c) => sum + c.students, 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("course")}</TableHead>
          <TableHead className="text-center">{t("students")}</TableHead>
          <TableHead className="text-end">{t("revenue")}</TableHead>
          <TableHead className="text-end">{t("yourEarnings")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {courses.map((course) => (
          <TableRow key={course.id}>
            <TableCell className="font-medium">
              {locale === "ar" && course.titleAr
                ? course.titleAr
                : course.titleEn}
            </TableCell>
            <TableCell className="text-center">{course.students}</TableCell>
            <TableCell className="text-end">
              ${course.revenue.toFixed(2)}
            </TableCell>
            <TableCell className="text-end text-green-600 font-medium">
              ${course.earnings.toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold">
          <TableCell>{t("total")}</TableCell>
          <TableCell className="text-center">{totalStudents}</TableCell>
          <TableCell className="text-end">
            ${totalRevenue.toFixed(2)}
          </TableCell>
          <TableCell className="text-end text-green-600">
            ${totalEarnings.toFixed(2)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
