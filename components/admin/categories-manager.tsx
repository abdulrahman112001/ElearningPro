"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  Plus,
  Pencil,
  Trash2,
  Folder,
  FolderOpen,
  Loader2,
  BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  parentId: string | null
  parent: {
    id: string
    name: string
  } | null
  children: {
    id: string
    name: string
  }[]
  _count: {
    courses: number
  }
}

interface CategoriesManagerProps {
  categories: Category[]
}

export function CategoriesManager({ categories }: CategoriesManagerProps) {
  const t = useTranslations("admin")
  const router = useRouter()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    parentId: "",
  })

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      icon: "",
      parentId: "",
    })
    setEditCategory(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (category: Category) => {
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      icon: category.icon || "",
      parentId: category.parentId || "",
    })
    setEditCategory(category)
    setIsDialogOpen(true)
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.slug) {
      toast.error(t("nameSlugRequired"))
      return
    }

    setLoading(true)

    try {
      const url = editCategory
        ? `/api/admin/categories/${editCategory.id}`
        : "/api/admin/categories"

      const response = await fetch(url, {
        method: editCategory ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          icon: formData.icon || null,
          parentId:
            formData.parentId && formData.parentId !== "none"
              ? formData.parentId
              : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save category")
      }

      toast.success(editCategory ? t("categoryUpdated") : t("categoryCreated"))
      setIsDialogOpen(false)
      resetForm()
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || t("error"))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteCategory) return

    setLoading(true)

    try {
      const response = await fetch(
        `/api/admin/categories/${deleteCategory.id}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete category")
      }

      toast.success(t("categoryDeleted"))
      setDeleteCategory(null)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || t("error"))
    } finally {
      setLoading(false)
    }
  }

  const parentCategories = categories.filter((c) => !c.parentId)
  const childCategories = categories.filter((c) => c.parentId)

  return (
    <div className="space-y-6">
      {/* Add Button */}
      <div className="flex justify-end">
        <Button onClick={openCreateDialog}>
          <Plus className="me-2 h-4 w-4" />
          {t("addCategory")}
        </Button>
      </div>

      {/* Categories Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {parentCategories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditDialog(category)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteCategory(category)}
                    disabled={category._count.courses > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {category.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {category.description}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <BookOpen className="me-1 h-3 w-3" />
                  {category._count.courses} {t("courses")}
                </Badge>
                <Badge variant="outline">{category.slug}</Badge>
              </div>

              {/* Subcategories */}
              {category.children.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">
                    {t("subcategories")}
                  </p>
                  <div className="space-y-1">
                    {category.children.map((child) => {
                      const fullChild = categories.find(
                        (c) => c.id === child.id
                      )
                      return (
                        <div
                          key={child.id}
                          className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                        >
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4" />
                            <span>{child.name}</span>
                          </div>
                          <div className="flex gap-1">
                            {fullChild && (
                              <>
                                <Badge variant="secondary" className="text-xs">
                                  {fullChild._count.courses}
                                </Badge>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => openEditDialog(fullChild)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setDeleteCategory(fullChild)}
                                  disabled={fullChild._count.courses > 0}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Folder className="h-12 w-12 mx-auto mb-4" />
          <p>{t("noCategories")}</p>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editCategory ? t("editCategory") : t("addCategory")}
            </DialogTitle>
            <DialogDescription>
              {editCategory
                ? t("editCategoryDescription")
                : t("addCategoryDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("name")} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    name: e.target.value,
                    slug: generateSlug(e.target.value),
                  })
                }}
                placeholder={t("categoryNamePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("slug")} *</Label>
              <Input
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="category-slug"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("categoryDescriptionPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("icon")}</Label>
              <Input
                value={formData.icon}
                onChange={(e) =>
                  setFormData({ ...formData, icon: e.target.value })
                }
                placeholder="💻"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("parentCategory")}</Label>
              <Select
                value={formData.parentId}
                onValueChange={(value) =>
                  setFormData({ ...formData, parentId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectParent")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noParent")}</SelectItem>
                  {parentCategories
                    .filter((c) => c.id !== editCategory?.id)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                resetForm()
              }}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {editCategory ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteCategory}
        onOpenChange={() => setDeleteCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteCategoryWarning", { name: deleteCategory?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive"
            >
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
