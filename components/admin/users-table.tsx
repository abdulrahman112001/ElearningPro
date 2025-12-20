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
  Shield,
  Ban,
  Trash2,
  User,
  BookOpen,
  GraduationCap,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  isBlocked: boolean
  isVerified: boolean
  createdAt: Date
  _count: {
    courses: number
    enrollments: number
  }
}

interface UsersTableProps {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function UsersTable({ users, pagination }: UsersTableProps) {
  const t = useTranslations("admin")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateLocale = locale === "ar" ? ar : enUS

  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "")
  const [deleteUser, setDeleteUser] = useState<User | null>(null)

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (roleFilter) params.set("role", roleFilter)
    router.push(`/admin/users?${params.toString()}`)
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })

      if (!response.ok) throw new Error("Failed to update role")

      toast.success(t("roleUpdated"))
      router.refresh()
    } catch (error) {
      toast.error(t("error"))
    }
  }

  const handleBlockToggle = async (user: User) => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: !user.isBlocked }),
      })

      if (!response.ok) throw new Error("Failed to update user")

      toast.success(user.isBlocked ? t("userUnblocked") : t("userBlocked"))
      router.refresh()
    } catch (error) {
      toast.error(t("error"))
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return

    try {
      const response = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete user")

      toast.success(t("userDeleted"))
      setDeleteUser(null)
      router.refresh()
    } catch (error) {
      toast.error(t("error"))
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Badge variant="destructive">{t("admin")}</Badge>
      case "INSTRUCTOR":
        return <Badge variant="default">{t("instructor")}</Badge>
      default:
        return <Badge variant="secondary">{t("student")}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder={t("searchUsers")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-sm"
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <Select
          value={roleFilter || "all"}
          onValueChange={(value) => {
            setRoleFilter(value === "all" ? "" : value)
            const params = new URLSearchParams(searchParams.toString())
            if (value && value !== "all") params.set("role", value)
            else params.delete("role")
            router.push(`/admin/users?${params.toString()}`)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allRoles")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allRoles")}</SelectItem>
            <SelectItem value="STUDENT">{t("students")}</SelectItem>
            <SelectItem value="INSTRUCTOR">{t("instructors")}</SelectItem>
            <SelectItem value="ADMIN">{t("admins")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("user")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("courses")}</TableHead>
              <TableHead>{t("joinedDate")}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={user.image || undefined} />
                      <AvatarFallback>
                        {user.name?.charAt(0) || user.email.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name || "No name"}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>
                  {user.isBlocked ? (
                    <Badge variant="destructive">{t("blocked")}</Badge>
                  ) : user.isVerified ? (
                    <Badge variant="outline" className="text-green-600">
                      {t("verified")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t("active")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {user._count.courses}
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-4 w-4" />
                      {user._count.enrollments}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {format(new Date(user.createdAt), "PP", {
                    locale: dateLocale,
                  })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(user.id, "STUDENT")}
                        disabled={user.role === "STUDENT"}
                      >
                        <User className="me-2 h-4 w-4" />
                        {t("makeStudent")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(user.id, "INSTRUCTOR")}
                        disabled={user.role === "INSTRUCTOR"}
                      >
                        <BookOpen className="me-2 h-4 w-4" />
                        {t("makeInstructor")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(user.id, "ADMIN")}
                        disabled={user.role === "ADMIN"}
                      >
                        <Shield className="me-2 h-4 w-4" />
                        {t("makeAdmin")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleBlockToggle(user)}>
                        <Ban className="me-2 h-4 w-4" />
                        {user.isBlocked ? t("unblock") : t("block")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteUser(user)}
                        className="text-destructive"
                      >
                        <Trash2 className="me-2 h-4 w-4" />
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={`/admin/users?page=${pagination.page - 1}`}
                aria-disabled={pagination.page === 1}
              />
            </PaginationItem>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
              (page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href={`/admin/users?page=${page}`}
                    isActive={page === pagination.page}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                href={`/admin/users?page=${pagination.page + 1}`}
                aria-disabled={pagination.page === pagination.pages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteUserWarning", { email: deleteUser?.email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
