"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { format } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import toast from "react-hot-toast"
import {
  Search,
  MoreVertical,
  ShieldCheck,
  ShieldOff,
  Ban,
  CheckCircle,
  Clock,
  Loader2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent } from "@/components/ui/card"

interface InstructorProfile {
  isApproved: boolean
  approvedAt?: string | null
  commissionRate?: number | null
  totalEarnings?: number | null
  pendingEarnings?: number | null
}

interface Instructor {
  id: string
  name: string | null
  email: string
  image: string | null
  headline?: string | null
  bio?: string | null
  isBlocked: boolean
  createdAt: string
  instructorProfile: InstructorProfile | null
  _count: {
    courses: number
  }
}

interface InstructorsTableProps {
  instructors: Instructor[]
  pendingCount: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function InstructorsTable({
  instructors,
  pendingCount,
  pagination,
}: InstructorsTableProps) {
  const t = useTranslations("admin")
  const common = useTranslations("common")
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const dateLocale = locale === "ar" ? ar : enUS

  const [search, setSearch] = useState(searchParams?.get("search") || "")
  const [loading, setLoading] = useState<string | null>(null)
  const [actionDialog, setActionDialog] = useState<{
    type: "approve" | "block" | "unblock" | null
    instructor: Instructor | null
  }>({ type: null, instructor: null })

  const handleSearch = (value: string) => {
    setSearch(value)
    const params = new URLSearchParams(searchParams?.toString() || "")
    if (value) {
      params.set("search", value)
    } else {
      params.delete("search")
    }
    params.set("page", "1")
    router.push(`/admin/instructors?${params.toString()}`)
  }

  const handleFilter = (filter: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "")
    if (filter === "all") {
      params.delete("filter")
    } else {
      params.set("filter", filter)
    }
    params.set("page", "1")
    router.push(`/admin/instructors?${params.toString()}`)
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "")
    params.set("page", newPage.toString())
    router.push(`/admin/instructors?${params.toString()}`)
  }

  const handleAction = async () => {
    if (!actionDialog.type || !actionDialog.instructor) return

    setLoading(actionDialog.instructor.id)
    try {
      const response = await fetch(
        `/api/admin/instructors/${actionDialog.instructor.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: actionDialog.type }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to perform action")
      }

      toast.success(t("actionSuccess"))
      router.refresh()
    } catch (error) {
      toast.error(common("error"))
    } finally {
      setLoading(null)
      setActionDialog({ type: null, instructor: null })
    }
  }

  const getStatusBadge = (instructor: Instructor) => {
    if (instructor.isBlocked) {
      return (
        <Badge variant="destructive" className="gap-1">
          <Ban className="h-3 w-3" />
          {t("blocked")}
        </Badge>
      )
    }
    if (!instructor.instructorProfile?.isApproved) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          {t("pending")}
        </Badge>
      )
    }
    return (
      <Badge variant="default" className="gap-1 bg-green-500">
        <CheckCircle className="h-3 w-3" />
        {t("approved")}
      </Badge>
    )
  }

  const currentFilter = searchParams?.get("filter") || "all"

  return (
    <div className="space-y-4">
      {/* Stats Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {t("totalInstructors")}: {pagination.total}
              </span>
            </div>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {t("pendingApproval")}: {pendingCount}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchInstructors")}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={currentFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilter("all")}
          >
            {common("all")}
          </Button>
          <Button
            variant={currentFilter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilter("pending")}
          >
            {t("pending")}
          </Button>
          <Button
            variant={currentFilter === "approved" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilter("approved")}
          >
            {t("approved")}
          </Button>
          <Button
            variant={currentFilter === "blocked" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilter("blocked")}
          >
            {t("blocked")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("instructor")}</TableHead>
              <TableHead>{t("courses")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("earnings")}</TableHead>
              <TableHead>{t("joinedAt")}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instructors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  {t("noInstructors")}
                </TableCell>
              </TableRow>
            ) : (
              instructors.map((instructor) => (
                <TableRow key={instructor.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={instructor.image || undefined} />
                        <AvatarFallback>
                          {instructor.name?.[0]?.toUpperCase() || "I"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {instructor.name || t("unnamed")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {instructor.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{instructor._count.courses}</TableCell>
                  <TableCell>{getStatusBadge(instructor)}</TableCell>
                  <TableCell>
                    $
                    {instructor.instructorProfile?.totalEarnings?.toFixed(2) ||
                      "0.00"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(instructor.createdAt), "PP", {
                      locale: dateLocale,
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={loading === instructor.id}
                        >
                          {loading === instructor.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreVertical className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!instructor.instructorProfile?.isApproved &&
                          !instructor.isBlocked && (
                            <DropdownMenuItem
                              onClick={() =>
                                setActionDialog({
                                  type: "approve",
                                  instructor,
                                })
                              }
                            >
                              <ShieldCheck className="me-2 h-4 w-4" />
                              {t("approve")}
                            </DropdownMenuItem>
                          )}
                        <DropdownMenuSeparator />
                        {instructor.isBlocked ? (
                          <DropdownMenuItem
                            onClick={() =>
                              setActionDialog({
                                type: "unblock",
                                instructor,
                              })
                            }
                          >
                            <CheckCircle className="me-2 h-4 w-4" />
                            {t("unblock")}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              setActionDialog({
                                type: "block",
                                instructor,
                              })
                            }
                            className="text-destructive"
                          >
                            <ShieldOff className="me-2 h-4 w-4" />
                            {t("block")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("paginationLabel", {
              start: (pagination.page - 1) * pagination.limit + 1,
              end: Math.min(
                pagination.page * pagination.limit,
                pagination.total
              ),
              total: pagination.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              {common("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              {common("next")}
            </Button>
          </div>
        </div>
      )}

      {/* Action Dialog */}
      <AlertDialog
        open={!!actionDialog.type}
        onOpenChange={() => setActionDialog({ type: null, instructor: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.type === "approve" && t("confirmApprove")}
              {actionDialog.type === "block" && t("confirmBlock")}
              {actionDialog.type === "unblock" && t("confirmUnblock")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.type === "approve" &&
                t("confirmApproveDescription", {
                  name:
                    actionDialog.instructor?.name ||
                    actionDialog.instructor?.email,
                })}
              {actionDialog.type === "block" &&
                t("confirmBlockDescription", {
                  name:
                    actionDialog.instructor?.name ||
                    actionDialog.instructor?.email,
                })}
              {actionDialog.type === "unblock" &&
                t("confirmUnblockDescription", {
                  name:
                    actionDialog.instructor?.name ||
                    actionDialog.instructor?.email,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction}>
              {common("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
