"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export type RevenuePoint = {
  period: string
  mrr: number
}

const sampleRevenue: RevenuePoint[] = [
  { period: "NOV", mrr: 39000 },
  { period: "DEC", mrr: 44000 },
  { period: "JAN", mrr: 48000 },
  { period: "FEB", mrr: 54000 },
  { period: "MAR", mrr: 59000 },
  { period: "APR", mrr: 64280 },
]

const chartConfig = {
  mrr: {
    label: "Monthly recurring revenue",
    color: "#00e55b",
  },
} satisfies ChartConfig

type RevenueChartProps = {
  data?: RevenuePoint[]
  currency?: string
}

export function RevenueChart({ data = sampleRevenue, currency = "USD" }: RevenueChartProps) {
  const safeCurrency = /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : "USD"
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 0,
  })

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full">
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
      >
        <CartesianGrid vertical={false} stroke="#53614e" strokeDasharray="3 3" />
        <XAxis
          dataKey="period"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          tick={{ fill: "#a9b7aa", fontSize: 10, fontFamily: "monospace" }}
        />
        <YAxis hide domain={[0, "dataMax"]} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => [formatter.format(Number(value)), "MRR"]}
            />
          }
        />
        <Bar dataKey="mrr" fill="var(--color-mrr)" radius={0} />
      </BarChart>
    </ChartContainer>
  )
}
