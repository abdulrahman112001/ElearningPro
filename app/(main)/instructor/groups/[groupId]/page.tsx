"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  BookOpen,
  Loader2,
  Pencil,
  Save,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  AvatarName,
  EmptyState,
  ListSkeleton,
  PageHeader,
  PageHeaderSkeleton,
  SectionCard,
  StatusBadge,
  TableSkeleton,
} from "@/components/shared"

const NO_GRADE = "__none__"

interface GradeLevel {
  id: string
  nameAr: string
  nameEn: string
}

interface GroupDetail {
  id: string
  name: string
  description: string | null
  gradeLevelId: string | null
  gradeLevel: GradeLevel | null
  members: {
    id: string
    joinedAt: string
    student: { id: string; name: string | null; email: string | null; image: string | null }
  }[]
  courses: { id: string; titleAr: string; titleEn: string; slug: string; status: string }[]
}

export default function GroupDetailPage() {
  const params = useParams<{ groupId: string }>()
  const groupId = params?.groupId
  const t = useTranslations("groups")
  const tc = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()

  const [group, setGroup] = React.useState<GroupDetail | null>(null)
  const [notFound, setNotFound] = React.useState(false)
  const [grades, setGrades] = React.useState<GradeLevel[]>([])

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [gradeLevelId, setGradeLevelId] = React.useState(NO_GRADE)
  const [saving, setSaving] = React.useState(false)

  const [email, setEmail] = React.useState("")
  const [adding, setAdding] = React.useState(false)
  const [addError, setAddError] = React.useState<string | null>(null)

  const [removeTarget, setRemoveTarget] = React.useState<GroupDetail["members"][number] | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const pick = (ar?: string | null, en?: string | null) =>
    locale === "ar" ? ar || en || "" : en || ar || ""
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  const load = React.useCallback(async () => {
    if (!groupId) return
    const res = await fetch(`/api/instructor/groups/${groupId}`)
    if (!res.ok) {
      setNotFound(true)
      return
    }
    const data: GroupDetail = await res.json()
    setGroup(data)
    return data
  }, [groupId])

  React.useEffect(() => {
    load().then((data) => {
      if (data) {
        setName(data.name)
        setDescription(data.description ?? "")
        setGradeLevelId(data.gradeLevelId ?? NO_GRADE)
      }
    }).catch(() => setNotFound(true))
    fetch("/api/grade-levels")
      .then((r) => (r.ok ? r.json() : []))
      .then(setGrades)
      .catch(() => setGrades([]))
  }, [load])

  const dirty =
    !!group &&
    (name.trim() !== group.name ||
      (description.trim() || null) !== (group.description || null) ||
      (gradeLevelId === NO_GRADE ? null : gradeLevelId) !== (group.gradeLevelId ?? null))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t("nameRequired"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/instructor/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          gradeLevelId: gradeLevelId === NO_GRADE ? null : gradeLevelId,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(t("saved"))
      await load()
    } catch {
      toast.error(t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!value) {
      setAddError(t("emailRequired"))
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch(`/api/instructor/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      })
      if (res.status === 404) {
        setAddError(t("studentNotFound"))
        return
      }
      if (!res.ok) throw new Error()
      toast.success(t("memberAdded"))
      setEmail("")
      await load()
    } catch {
      setAddError(t("addFailed"))
    } finally {
      setAdding(false)
    }
  }

  const removeMember = async () => {
    const target = removeTarget
    setRemoveTarget(null)
    if (!target) return
    try {
      const res = await fetch(`/api/instructor/groups/${groupId}/members/${target.student.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      toast.success(t("memberRemoved"))
      setGroup((g) => (g ? { ...g, members: g.members.filter((m) => m.id !== target.id) } : g))
    } catch {
      toast.error(t("removeFailed"))
    }
  }

  const deleteGroup = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/instructor/groups/${groupId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(t("deleted"))
      router.push("/instructor/groups")
    } catch {
      toast.error(t("deleteFailed"))
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (notFound) {
    return (
      <EmptyState
        icon={UsersRound}
        title={t("notFound")}
        action={
          <Button asChild variant="outline">
            <Link href="/instructor/groups">{t("backToGroups")}</Link>
          </Button>
        }
      />
    )
  }

  if (!group) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <div className="grid gap-6 lg:grid-cols-3">
          <ListSkeleton rows={3} />
          <TableSkeleton rows={4} className="lg:col-span-2" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersRound}
        title={group.name}
        description={group.gradeLevel ? pick(group.gradeLevel.nameAr, group.gradeLevel.nameEn) : t("subtitleDetail")}
        breadcrumbs={[
          { label: t("title"), href: "/instructor/groups" },
          { label: group.name },
        ]}
        actions={
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t("deleteGroup")}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <SectionCard icon={Pencil} title={t("detailsTitle")}>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">{t("nameLabel")}</Label>
                <Input
                  id="group-name"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-description">{t("descriptionLabel")}</Label>
                <Textarea
                  id="group-description"
                  value={description}
                  rows={3}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("gradeLabel")}</Label>
                <Select value={gradeLevelId} onValueChange={setGradeLevelId} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectGrade")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_GRADE}>{t("noGrade")}</SelectItem>
                    {grades.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {pick(g.nameAr, g.nameEn)}
                      </SelectItem>
                    ))}
                    {group.gradeLevel && !grades.some((g) => g.id === group.gradeLevel?.id) && (
                      <SelectItem value={group.gradeLevel.id}>
                        {pick(group.gradeLevel.nameAr, group.gradeLevel.nameEn)}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={saving || !dirty} className="w-full gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {tc("save")}
              </Button>
            </form>
          </SectionCard>

          <SectionCard
            icon={BookOpen}
            title={t("attachedCourses")}
            description={t("attachedCoursesHint")}
            contentClassName="p-0"
          >
            {group.courses.length === 0 ? (
              <EmptyState
                variant="plain"
                size="sm"
                icon={BookOpen}
                title={t("noCourses")}
                description={t("noCoursesHint")}
              />
            ) : (
              <ul className="divide-y">
                {group.courses.map((course) => (
                  <li key={course.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <Link
                      href={`/instructor/courses/${course.id}/edit`}
                      className="min-w-0 truncate text-sm font-medium hover:text-primary hover:underline"
                    >
                      {pick(course.titleAr, course.titleEn)}
                    </Link>
                    <StatusBadge status={course.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <SectionCard
          className="lg:col-span-2"
          icon={Users}
          title={t("membersTitle")}
          description={t("membersCount", { count: group.members.length })}
          contentClassName="p-0"
        >
          <form onSubmit={addMember} className="border-b px-4 py-4 sm:px-6">
            <Label htmlFor="member-email" className="mb-2 block">
              {t("addByEmail")}
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="member-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setAddError(null)
                }}
                placeholder="student@example.com"
                disabled={adding}
                className="flex-1"
              />
              <Button type="submit" disabled={adding} className="gap-2">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {t("addMember")}
              </Button>
            </div>
            {addError && (
              <p role="alert" className="mt-2 text-sm font-medium text-destructive">
                {addError}
              </p>
            )}
          </form>

          {group.members.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={Users}
              title={t("noMembers")}
              description={t("noMembersHint")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="ps-4 sm:ps-6">{t("student")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("joinedAt")}</TableHead>
                  <TableHead className="w-12 pe-4 sm:pe-6">
                    <span className="sr-only">{t("actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="ps-4 sm:ps-6">
                      <AvatarName
                        name={m.student.name}
                        image={m.student.image}
                        secondary={<span dir="ltr">{m.student.email}</span>}
                        className="max-w-[16rem] sm:max-w-sm"
                      />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {dateFmt.format(new Date(m.joinedAt))}
                    </TableCell>
                    <TableCell className="pe-4 text-end sm:pe-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={t("removeMemberNamed", { name: m.student.name ?? "" })}
                        onClick={() => setRemoveTarget(m)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeMemberTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeMemberDescription", { name: removeTarget?.student.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteGroupTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteGroupDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                deleteGroup()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
