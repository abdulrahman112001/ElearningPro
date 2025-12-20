"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import toast from "react-hot-toast"

interface NotificationSettingsProps {
  userId: string
}

export function NotificationSettings({ userId }: NotificationSettingsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const [settings, setSettings] = useState({
    emailNotifications: true,
    courseUpdates: true,
    promotions: false,
    newCourses: true,
    completionReminders: true,
    liveClassReminders: true,
  })

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error("Failed to update notifications")
      }

      toast.success("تم حفظ إعدادات الإشعارات")
      router.refresh()
    } catch (error) {
      toast.error("حدث خطأ أثناء الحفظ")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <div>
        <h3 className="font-medium mb-4">إشعارات البريد الإلكتروني</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="emailNotifications" className="font-normal">
                تفعيل إشعارات البريد
              </Label>
              <p className="text-sm text-muted-foreground">
                استلم جميع الإشعارات عبر البريد الإلكتروني
              </p>
            </div>
            <Switch
              id="emailNotifications"
              checked={settings.emailNotifications}
              onCheckedChange={() => handleToggle("emailNotifications")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="courseUpdates" className="font-normal">
                تحديثات الكورسات
              </Label>
              <p className="text-sm text-muted-foreground">
                إشعارات عند تحديث كورساتك المسجل بها
              </p>
            </div>
            <Switch
              id="courseUpdates"
              checked={settings.courseUpdates}
              onCheckedChange={() => handleToggle("courseUpdates")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="newCourses" className="font-normal">
                كورسات جديدة
              </Label>
              <p className="text-sm text-muted-foreground">
                إشعارات عند إضافة كورسات جديدة في مجالاتك المفضلة
              </p>
            </div>
            <Switch
              id="newCourses"
              checked={settings.newCourses}
              onCheckedChange={() => handleToggle("newCourses")}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Learning Reminders */}
      <div>
        <h3 className="font-medium mb-4">تذكيرات التعلم</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="completionReminders" className="font-normal">
                تذكيرات إكمال الكورسات
              </Label>
              <p className="text-sm text-muted-foreground">
                تذكيرات لإكمال الكورسات التي بدأتها
              </p>
            </div>
            <Switch
              id="completionReminders"
              checked={settings.completionReminders}
              onCheckedChange={() => handleToggle("completionReminders")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="liveClassReminders" className="font-normal">
                تذكيرات البث المباشر
              </Label>
              <p className="text-sm text-muted-foreground">
                تذكيرات قبل بدء البث المباشر
              </p>
            </div>
            <Switch
              id="liveClassReminders"
              checked={settings.liveClassReminders}
              onCheckedChange={() => handleToggle("liveClassReminders")}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Marketing */}
      <div>
        <h3 className="font-medium mb-4">التسويق</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="promotions" className="font-normal">
                العروض والخصومات
              </Label>
              <p className="text-sm text-muted-foreground">
                استلم إشعارات عن العروض الخاصة والخصومات
              </p>
            </div>
            <Switch
              id="promotions"
              checked={settings.promotions}
              onCheckedChange={() => handleToggle("promotions")}
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={isLoading}>
        {isLoading && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
        حفظ الإعدادات
      </Button>
    </div>
  )
}
