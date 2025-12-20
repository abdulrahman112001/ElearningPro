"use client"

import { useTranslations } from "next-intl"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

// Mock data - in production, this would come from the API
const data = [
  { month: "Jan", earnings: 400 },
  { month: "Feb", earnings: 600 },
  { month: "Mar", earnings: 550 },
  { month: "Apr", earnings: 800 },
  { month: "May", earnings: 750 },
  { month: "Jun", earnings: 900 },
]

export function EarningsChart() {
  const t = useTranslations("instructor")

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip
            formatter={(value: number) => [`$${value}`, t("earnings")]}
          />
          <Line
            type="monotone"
            dataKey="earnings"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
