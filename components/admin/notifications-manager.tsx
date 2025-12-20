"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { format } from "date-fns"
import toast from "react-hot-toast"
import {
  Bell,
  Send,
  Trash2,
  Search,
  Filter,
  Loader2,
  Mail,
  CheckCircle2,
  CircleDashed,
  Link as LinkIcon,
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

interface NotificationUser {
  id: string
  name: string | null
  email: string
  image?: string | null
}

interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  link?: string | null
  isRead: boolean
  createdAt: string
  user: NotificationUser
}

interface NotificationStat {
  type: string
  _count: number
}

interface NotificationsManagerProps {
  notifications: NotificationItem[]
  stats: NotificationStat[]
  userCounts: {
    total: number
    students: number
    instructors: number
  }
  readCount: number
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

type TargetAudience = "ALL" | "STUDENTS" | "INSTRUCTORS" | "USER"

type ComposeState = {
  title: string
  message: string
  type: string
  target: TargetAudience
  email: string
  link: string
}

const notificationTypes = [
  "SYSTEM",
  "COURSE_PUBLISHED",
  "NEW_ENROLLMENT",
  "NEW_REVIEW",
  "PAYMENT_RECEIVED",
  "CERTIFICATE_ISSUED",
  "LIVE_SESSION_STARTING",
  "MESSAGE_RECEIVED",
]

const targetOptions: { value: TargetAudience; label: string }[] = [
  { value: "ALL", label: "targetAll" },
  { value: "STUDENTS", label: "targetStudents" },
  { value: "INSTRUCTORS", label: "targetInstructors" },
  { value: "USER", label: "targetUser" },
]

export function NotificationsManager({
  notifications,
  stats,
  userCounts,
  readCount,
  pagination,
}: NotificationsManagerProps) {
  const t = useTranslations("admin")
  const common = useTranslations("common")
  const router = useRouter()
  const searchParams = useSearchParams() as URLSearchParams

  const [filterType, setFilterType] = useState(
    searchParams.get("type") || "all"
  )
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [compose, setCompose] = useState<ComposeState>({
    title: "",
    message: "",
    type: "SYSTEM",
    target: "ALL",
    email: "",
    link: "",
  })
  const [sending, setSending] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NotificationItem | null>(
    null
  )

  const handleFilterChange = (value: string) => {
    setFilterType(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") params.set("type", value)
    else params.delete("type")
    params.delete("page")
    router.push(`/admin/notifications?${params.toString()}`)
  }

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (search) params.set("search", search)
    else params.delete("search")
    params.delete("page")
    router.push(`/admin/notifications?${params.toString()}`)
  }

  const handleSend = async () => {
    if (!compose.title.trim() || !compose.message.trim()) {
      toast.error(t("notificationInvalid"))
      return
    }

    if (compose.target === "USER" && !compose.email.trim()) {
      toast.error(t("notificationEmailRequired"))
      return
    }

    setSending(true)
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: compose.title.trim(),
          message: compose.message.trim(),
          type: compose.type,
          target: compose.target,
          email: compose.email.trim() || undefined,
          link: compose.link.trim() || undefined,
        }),
      })

      if (!response.ok) throw new Error("send_failed")

      toast.success(t("notificationSent"))
      setCompose({
        title: "",
        message: "",
        type: "SYSTEM",
        target: "ALL",
        email: "",
        link: "",
      })
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(t("error"))
    } finally {
      setSending(false)
    }
  }

  const handleToggleRead = async (notification: NotificationItem) => {
    setProcessingId(notification.id)
    try {
      const response = await fetch(
        `/api/admin/notifications/${notification.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: !notification.isRead }),
        }
      )

      if (!response.ok) throw new Error("toggle_failed")

      toast.success(
        !notification.isRead
          ? t("notificationMarkedRead")
          : t("notificationMarkedUnread")
      )
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(t("error"))
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setProcessingId(deleteTarget.id)
    try {
      const response = await fetch(
        `/api/admin/notifications/${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) throw new Error("delete_failed")

      toast.success(t("notificationDeleted"))
      setDeleteTarget(null)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(t("error"))
    } finally {
      setProcessingId(null)
    }
  }

  const statsMap = useMemo(() => {
    const map = new Map<string, number>()
    stats.forEach((stat) => map.set(stat.type, stat._count))
    return map
  }, [stats])

  const copyLink = (link?: string | null) => {
    if (!link) return
    navigator.clipboard
      .writeText(link)
      .then(() => toast.success(t("copied")))
      .catch(() => toast.error(t("copyFailed")))
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Bell className="h-4 w-4" />
              {t("totalNotifications")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{pagination.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {t("readNotifications")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{readCount}</p>
            <p className="text-xs text-muted-foreground">{t("readHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <CircleDashed className="h-4 w-4 text-amber-500" />
              {t("pendingNotifications")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {Math.max(pagination.total - readCount, 0)}
            </p>
            <p className="text-xs text-muted-foreground">{t("pendingHint")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("composeNotification")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder={t("notificationTitlePlaceholder")}
              value={compose.title}
              onChange={(e) =>
                setCompose((prev) => ({ ...prev, title: e.target.value }))
              }
            />
            <Textarea
              placeholder={t("notificationMessagePlaceholder")}
              value={compose.message}
              onChange={(e) =>
                setCompose((prev) => ({ ...prev, message: e.target.value }))
              }
              rows={5}
            />
            <Input
              placeholder={t("notificationLinkPlaceholder")}
              value={compose.link}
              onChange={(e) =>
                setCompose((prev) => ({ ...prev, link: e.target.value }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                value={compose.type}
                onValueChange={(value) =>
                  setCompose((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("notificationType")} />
                </SelectTrigger>
                <SelectContent>
                  {notificationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`notificationTypeLabels.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={compose.target}
                onValueChange={(value: TargetAudience) =>
                  setCompose((prev) => ({ ...prev, target: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("notificationTarget")} />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {compose.target === "USER" && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("notificationEmailPlaceholder")}
                  value={compose.email}
                  onChange={(e) =>
                    setCompose((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div>
                <p className="font-semibold">{t("totalUsers")}</p>
                <p>{userCounts.total}</p>
              </div>
              <div>
                <p className="font-semibold">{t("students")}</p>
                <p>{userCounts.students}</p>
              </div>
              <div>
                <p className="font-semibold">{t("instructors")}</p>
                <p>{userCounts.instructors}</p>
              </div>
            </div>

            <Button
              className="flex items-center gap-2"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t("sendNotification")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("notificationFilters")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input
                  placeholder={t("searchNotifications")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button variant="secondary" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Select value={filterType} onValueChange={handleFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("filterByType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{common("all")}</SelectItem>
                  {notificationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`notificationTypeLabels.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("recipient")}</TableHead>
                    <TableHead>{t("title")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead className="text-end">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                      >
                        {t("noData")}
                      </TableCell>
                    </TableRow>
                  )}
                  {notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {notification.user.name || t("unnamed")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {notification.user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {notification.title}
                          </span>
                          <span className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {t(`notificationTypeLabels.${notification.type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={notification.isRead ? "outline" : "default"}
                        >
                          {notification.isRead ? t("read") : t("unread")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(notification.createdAt), "PP p")}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-2">
                          {notification.link && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyLink(notification.link)}
                            >
                              <LinkIcon className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleRead(notification)}
                            disabled={processingId === notification.id}
                          >
                            {processingId === notification.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : notification.isRead ? (
                              <CircleDashed className="h-4 w-4" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(notification)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
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
              router.push(`/admin/notifications?${params.toString()}`)
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
              router.push(`/admin/notifications?${params.toString()}`)
            }}
          >
            {common("next")}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteNotification")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteNotification")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingId === deleteTarget?.id}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex items-center gap-2"
              disabled={processingId === deleteTarget?.id}
              onClick={handleDelete}
            >
              {processingId === deleteTarget?.id && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
