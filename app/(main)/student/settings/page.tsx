import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, User, Bell, Shield, CreditCard } from "lucide-react"
import { ProfileForm } from "@/components/settings/profile-form"
import { PasswordForm } from "@/components/settings/password-form"
import { NotificationSettings } from "@/components/settings/notification-settings"

export async function generateMetadata() {
  const t = await getTranslations("student")
  return {
    title: t("settings"),
  }
}

export default async function StudentSettingsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const t = await getTranslations("settings")

  // Get user data
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      bio: true,
    },
  })

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="container py-8">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t("profile")}
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("security")}
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="flex items-center gap-2"
          >
            <Bell className="h-4 w-4" />
            {t("notifications")}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("profileInfo")}
              </CardTitle>
              <CardDescription>{t("profileInfoDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm user={user} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t("changePassword")}
              </CardTitle>
              <CardDescription>
                {t("changePasswordDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordForm />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t("notificationPreferences")}
              </CardTitle>
              <CardDescription>
                {t("notificationPreferencesDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettings userId={user.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
