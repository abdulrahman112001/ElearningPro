"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Save, Loader2, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Settings {
  siteName: string
  siteDescription: string
  platformFee: number
  minWithdrawal: number
  currency: string
  supportEmail: string
  allowRegistration: boolean
  requireEmailVerification: boolean
  maintenanceMode: boolean
  paymentGateways: {
    stripe: { enabled: boolean }
    paypal: { enabled: boolean }
    paymob: { enabled: boolean }
    tap: { enabled: boolean }
  }
}

interface SettingsFormProps {
  initialSettings: Settings
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const t = useTranslations("admin")
  const [settings, setSettings] = useState(initialSettings)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error("Failed to save settings")
      }

      toast.success(t("settingsSaved"))
    } catch (error) {
      console.error("Save settings error:", error)
      toast.error(t("error"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList>
        <TabsTrigger value="general">{t("general")}</TabsTrigger>
        <TabsTrigger value="payments">{t("payments")}</TabsTrigger>
        <TabsTrigger value="advanced">{t("advanced")}</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("siteInformation")}</CardTitle>
            <CardDescription>{t("siteInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("siteName")}</Label>
              <Input
                value={settings.siteName}
                onChange={(e) =>
                  setSettings({ ...settings, siteName: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t("siteDescription")}</Label>
              <Textarea
                value={settings.siteDescription}
                onChange={(e) =>
                  setSettings({ ...settings, siteDescription: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t("supportEmail")}</Label>
              <Input
                type="email"
                value={settings.supportEmail}
                onChange={(e) =>
                  setSettings({ ...settings, supportEmail: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("registration")}</CardTitle>
            <CardDescription>{t("registrationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("allowRegistration")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("allowRegistrationDescription")}
                </p>
              </div>
              <Switch
                checked={settings.allowRegistration}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allowRegistration: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t("emailVerification")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("emailVerificationDescription")}
                </p>
              </div>
              <Switch
                checked={settings.requireEmailVerification}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    requireEmailVerification: checked,
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="payments" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("paymentSettings")}</CardTitle>
            <CardDescription>{t("paymentSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("platformFee")} (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.platformFee}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platformFee: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("platformFeeDescription")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("minWithdrawal")} ($)</Label>
                <Input
                  type="number"
                  min="0"
                  value={settings.minWithdrawal}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      minWithdrawal: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("minWithdrawalDescription")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("defaultCurrency")}</Label>
              <Select
                value={settings.currency}
                onValueChange={(value) =>
                  setSettings({ ...settings, currency: value })
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="EGP">EGP - Egyptian Pound</SelectItem>
                  <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                  <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t("paymentGateways")}
            </CardTitle>
            <CardDescription>{t("paymentGatewaysDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[#635bff] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <div>
                  <p className="font-medium">Stripe</p>
                  <p className="text-sm text-muted-foreground">
                    {t("internationalPayments")}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.paymentGateways.stripe.enabled}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    paymentGateways: {
                      ...settings.paymentGateways,
                      stripe: { enabled: checked },
                    },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[#0070ba] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">P</span>
                </div>
                <div>
                  <p className="font-medium">PayPal</p>
                  <p className="text-sm text-muted-foreground">
                    {t("paypalPayments")}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.paymentGateways.paypal.enabled}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    paymentGateways: {
                      ...settings.paymentGateways,
                      paypal: { enabled: checked },
                    },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[#0066ff] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">PM</span>
                </div>
                <div>
                  <p className="font-medium">Paymob</p>
                  <p className="text-sm text-muted-foreground">
                    {t("egyptPayments")}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.paymentGateways.paymob.enabled}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    paymentGateways: {
                      ...settings.paymentGateways,
                      paymob: { enabled: checked },
                    },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[#2eb87b] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">T</span>
                </div>
                <div>
                  <p className="font-medium">Tap</p>
                  <p className="text-sm text-muted-foreground">
                    {t("gulfPayments")}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.paymentGateways.tap.enabled}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    paymentGateways: {
                      ...settings.paymentGateways,
                      tap: { enabled: checked },
                    },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="advanced" className="space-y-6">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">{t("dangerZone")}</CardTitle>
            <CardDescription>{t("dangerZoneDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
              <div>
                <Label className="text-red-800">{t("maintenanceMode")}</Label>
                <p className="text-sm text-red-600">
                  {t("maintenanceModeDescription")}
                </p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, maintenanceMode: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="me-2 h-4 w-4" />
          )}
          {t("saveSettings")}
        </Button>
      </div>
    </Tabs>
  )
}
