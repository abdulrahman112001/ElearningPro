"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { format } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import toast from "react-hot-toast"
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Percent,
  Tag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface CouponCourse {
  id: string
  titleEn: string
  titleAr?: string | null
}

interface CouponCreator {
  id: string
  name: string | null
}

interface Coupon {
  id: string
  code: string
  discountType: "percentage" | "fixed"
  discountValue: number
  maxUses?: number | null
  usedCount: number
  minPurchase?: number | null
  maxDiscount?: number | null
  startDate: string
  expiryDate?: string | null
  isActive: boolean
  courseId?: string | null
  course?: CouponCourse | null
  createdBy?: CouponCreator | null
  createdAt: string
  updatedAt: string
  _count?: {
    purchases: number
  }
}

interface CouponsTableProps {
  coupons: Coupon[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

type DraftCoupon = {
  code: string
  discountType: "percentage" | "fixed"
  discountValue: string
  maxUses: string
  minPurchase: string
  maxDiscount: string
  expiryDate: string
  courseId: string
}

export function CouponsTable({ coupons, pagination }: CouponsTableProps) {
  const t = useTranslations("admin")
  const common = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateLocale = locale === "ar" ? ar : enUS

  const [search, setSearch] = useState(searchParams?.get("search") || "")
  const [statusFilter, setStatusFilter] = useState(
    searchParams?.get("status") || "all"
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<DraftCoupon>({
    code: "",
    discountType: "percentage",
    discountValue: "10",
    maxUses: "",
    minPurchase: "",
    maxDiscount: "",
    expiryDate: "",
    courseId: "",
  })
  const [saving, setSaving] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    [locale]
  )

  const percentageFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [locale]
  )

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (search) params.set("search", search)
    else params.delete("search")
    params.delete("page")
    router.push(`/admin/coupons?${params.toString()}`)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") params.set("status", value)
    else params.delete("status")
    params.delete("page")
    router.push(`/admin/coupons?${params.toString()}`)
  }

  const resetDraft = () => {
    setDraft({
      code: "",
      discountType: "percentage",
      discountValue: "10",
      maxUses: "",
      minPurchase: "",
      maxDiscount: "",
      expiryDate: "",
      courseId: "",
    })
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const body = {
        code: draft.code.trim(),
        discountType: draft.discountType,
        discountValue: Number(draft.discountValue) || 0,
        maxUses: draft.maxUses ? Number(draft.maxUses) : undefined,
        minPurchase: draft.minPurchase ? Number(draft.minPurchase) : undefined,
        maxDiscount: draft.maxDiscount ? Number(draft.maxDiscount) : undefined,
        expiryDate: draft.expiryDate
          ? new Date(draft.expiryDate).toISOString()
          : undefined,
        courseId: draft.courseId.trim() || undefined,
      }

      if (!body.code || !body.discountValue) {
        toast.error(t("couponFormInvalid"))
        setSaving(false)
        return
      }

      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error("create_failed")
      }

      toast.success(t("couponCreated"))
      setDialogOpen(false)
      resetDraft()
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(common("error"))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (coupon: Coupon) => {
    setProcessingId(coupon.id)
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      })

      if (!response.ok) throw new Error("toggle_failed")

      toast.success(
        !coupon.isActive ? t("couponActivated") : t("couponDeactivated")
      )
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(common("error"))
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setProcessingId(deleteTarget.id)
    try {
      const response = await fetch(`/api/admin/coupons/${deleteTarget.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("delete_failed")

      toast.success(t("couponDeleted"))
      setDeleteTarget(null)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(common("error"))
    } finally {
      setProcessingId(null)
    }
  }

  const renderDiscount = (coupon: Coupon) => {
    if (coupon.discountType === "percentage") {
      return (
        <span className="flex items-center gap-1 font-medium">
          <Percent className="h-4 w-4" />
          {percentageFormatter.format(coupon.discountValue / 100)}
        </span>
      )
    }

    return (
      <span className="flex items-center gap-1 font-medium">
        <Tag className="h-4 w-4" />
        {currencyFormatter.format(coupon.discountValue)}
      </span>
    )
  }

  const formatDate = (value?: string | null) => {
    if (!value) return t("noExpiry")
    try {
      return format(new Date(value), "PPP", { locale: dateLocale })
    } catch (error) {
      return t("noExpiry")
    }
  }

  const usageLabel = (coupon: Coupon) => {
    const used = coupon.usedCount ?? coupon._count?.purchases ?? 0
    if (!coupon.maxUses) return `${used}`
    return `${used}/${coupon.maxUses}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-1 gap-2 lg:max-w-lg">
          <Input
            placeholder={t("searchCoupons")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => handleStatusChange("all")}
          >
            {common("all")}
          </Button>
          <Button
            variant={statusFilter === "active" ? "default" : "outline"}
            onClick={() => handleStatusChange("active")}
          >
            {t("active")}
          </Button>
          <Button
            variant={statusFilter === "expired" ? "default" : "outline"}
            onClick={() => handleStatusChange("expired")}
          >
            {t("expired")}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("createCoupon")}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("code")}</TableHead>
              <TableHead>{t("discount")}</TableHead>
              <TableHead>{t("usage")}</TableHead>
              <TableHead>{t("course")}</TableHead>
              <TableHead>{t("validity")}</TableHead>
              <TableHead>{t("creator")}</TableHead>
              <TableHead className="text-end">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                >
                  {t("noData")}
                </TableCell>
              </TableRow>
            )}
            {coupons.map((coupon) => (
              <TableRow key={coupon.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{coupon.code}</span>
                    <Badge variant={coupon.isActive ? "default" : "secondary"}>
                      {coupon.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>{renderDiscount(coupon)}</TableCell>
                <TableCell>{usageLabel(coupon)}</TableCell>
                <TableCell>
                  {coupon.course ? (
                    <span>
                      {locale === "ar"
                        ? coupon.course.titleAr || coupon.course.titleEn
                        : coupon.course.titleEn}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("allCourses")}
                    </span>
                  )}
                </TableCell>
                <TableCell>{formatDate(coupon.expiryDate)}</TableCell>
                <TableCell>{coupon.createdBy?.name || "—"}</TableCell>
                <TableCell className="text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={processingId === coupon.id}
                        onClick={() => handleToggleActive(coupon)}
                        className="flex items-center gap-2"
                      >
                        {processingId === coupon.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : coupon.isActive ? (
                          <ToggleLeft className="h-4 w-4" />
                        ) : (
                          <ToggleRight className="h-4 w-4" />
                        )}
                        {coupon.isActive ? t("deactivate") : t("activate")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="flex items-center gap-2 text-destructive"
                        onClick={() => setDeleteTarget(coupon)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {common("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>
          {t("paginationLabel", {
            start: (pagination.page - 1) * pagination.limit + 1,
            end: Math.min(pagination.page * pagination.limit, pagination.total),
            total: pagination.total,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={pagination.page === 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set("page", String(pagination.page - 1))
              router.push(`/admin/coupons?${params.toString()}`)
            }}
          >
            {common("previous")}
          </Button>
          <Button
            variant="outline"
            disabled={pagination.page === pagination.pages}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set("page", String(pagination.page + 1))
              router.push(`/admin/coupons?${params.toString()}`)
            }}
          >
            {common("next")}
          </Button>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetDraft()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createCoupon")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">{t("code")}</Label>
              <Input
                id="code"
                value={draft.code}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder={t("couponCodePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("discountType")}</Label>
              <Select
                value={draft.discountType}
                onValueChange={(value: "percentage" | "fixed") =>
                  setDraft((prev) => ({ ...prev, discountType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectOption")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">{t("percentage")}</SelectItem>
                  <SelectItem value="fixed">{t("fixedAmount")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="discountValue">{t("discountValue")}</Label>
              <Input
                id="discountValue"
                type="number"
                min="0"
                value={draft.discountValue}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    discountValue: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxUses">{t("maxUses")}</Label>
              <Input
                id="maxUses"
                type="number"
                min="0"
                value={draft.maxUses}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, maxUses: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minPurchase">{t("minPurchase")}</Label>
              <Input
                id="minPurchase"
                type="number"
                min="0"
                value={draft.minPurchase}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, minPurchase: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxDiscount">{t("maxDiscount")}</Label>
              <Input
                id="maxDiscount"
                type="number"
                min="0"
                value={draft.maxDiscount}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, maxDiscount: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expiryDate">{t("expiryDate")}</Label>
              <Input
                id="expiryDate"
                type="date"
                value={draft.expiryDate}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, expiryDate: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="courseId">{t("courseIdOptional")}</Label>
              <Input
                id="courseId"
                value={draft.courseId}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, courseId: e.target.value }))
                }
                placeholder={t("courseIdHint")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {common("cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {common("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteCoupon")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteCoupon", { code: deleteTarget?.code })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingId === deleteTarget?.id}>
              {common("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex items-center gap-2"
              disabled={processingId === deleteTarget?.id}
              onClick={handleDelete}
            >
              {processingId === deleteTarget?.id && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {common("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
