"use client"

import { useMemo, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ProfileInsights } from "@/lib/profile-insights"

const SURFACE = "#101410"
const GRID = "#53614e"
const INK = "#a9b7aa"
const GREEN = "#00e55b"
const AMBER = "#ffddaf"
const TICK = { fill: INK, fontSize: 10, fontFamily: "monospace" } as const

const RANGES = [
  { key: 6, label: "6M" },
  { key: 12, label: "12M" },
  { key: 36, label: "All" },
] as const

function ChartCard({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <figure className="border border-[#53614e] p-4">
      <figcaption>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#00e55b]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#a9b7aa]">{caption}</p>
      </figcaption>
      <div className="mt-3">{children}</div>
    </figure>
  )
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className="flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.08em] text-[#e5f0e4]">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 border border-[#101410]" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function InsightsCharts({ insights }: { insights: ProfileInsights }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>(12)
  const currency = insights.currency.toUpperCase()

  const months = useMemo(() => insights.months.slice(-range), [insights.months, range])
  const money = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }),
    [currency],
  )
  const compact = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }),
    [currency],
  )

  const cumulativeConfig: ChartConfig = { cumulative: { label: "Cumulative revenue", color: GREEN } }
  const splitConfig: ChartConfig = {
    recurring: { label: "Recurring", color: GREEN },
    oneTime: { label: "One-time", color: AMBER },
  }
  const growthConfig: ChartConfig = { growthPct: { label: "Month-over-month", color: GREEN } }

  const growth = months.filter((month) => month.growthPct !== null)
  const hasSplit = months.some((month) => month.revenue > 0)

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#a9b7aa]">
          Calendar months (UTC) · {currency}
        </p>
        <div role="group" aria-label="Chart range" className="flex border border-[#53614e]">
          {RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={range === item.key}
              onClick={() => setRange(item.key)}
              className={
                "min-h-9 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e55b] " +
                (range === item.key ? "bg-[#00e55b] text-[#1c1c16]" : "text-[#e5f0e4] hover:bg-[#1c261d]")
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <ChartCard
            title="Cumulative revenue"
            caption="Running total of captured charges. It only goes up; the slope is the story."
          >
            <ChartContainer config={cumulativeConfig} className="aspect-auto h-60 w-full">
              <AreaChart accessibilityLayer data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} minTickGap={24} tick={TICK} />
                <YAxis
                  width={64}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={6}
                  tickFormatter={(value) => compact.format(Number(value))}
                  tick={TICK}
                />
                <ChartTooltip
                  cursor={{ stroke: GRID, strokeDasharray: "3 3" }}
                  content={<ChartTooltipContent formatter={(value) => [money.format(Number(value)), "Cumulative"]} />}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke={GREEN}
                  fill={GREEN}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: GREEN, stroke: SURFACE, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          </ChartCard>
        </div>

        <ChartCard
          title="Recurring vs one-time"
          caption="Monthly revenue split by whether the charge came from a subscription."
        >
          <Legend
            items={[
              { label: "Recurring", color: GREEN },
              { label: "One-time", color: AMBER },
            ]}
          />
          {hasSplit ? (
            <ChartContainer config={splitConfig} className="mt-2 aspect-auto h-52 w-full">
              <BarChart accessibilityLayer data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} minTickGap={24} tick={TICK} />
                <YAxis
                  width={56}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => compact.format(Number(value))}
                  tick={TICK}
                />
                <ChartTooltip
                  cursor={{ fill: "#1c261d" }}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [money.format(Number(value)), name === "recurring" ? "Recurring" : "One-time"]}
                    />
                  }
                />
                <Bar dataKey="recurring" stackId="s" fill={GREEN} stroke={SURFACE} strokeWidth={2} isAnimationActive={false} />
                <Bar
                  dataKey="oneTime"
                  stackId="s"
                  fill={AMBER}
                  stroke={SURFACE}
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="mt-6 text-sm text-[#a9b7aa]">No charges in this range.</p>
          )}
        </ChartCard>

        <ChartCard
          title="Month-over-month growth"
          caption="Change in revenue versus the previous month. Green is up, amber is down."
        >
          <Legend
            items={[
              { label: "Up", color: GREEN },
              { label: "Down", color: AMBER },
            ]}
          />
          {growth.length > 0 ? (
            <ChartContainer config={growthConfig} className="mt-2 aspect-auto h-52 w-full">
              <BarChart accessibilityLayer data={growth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} minTickGap={24} tick={TICK} />
                <YAxis
                  width={48}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${Math.round(Number(value))}%`}
                  tick={TICK}
                />
                <ChartTooltip
                  cursor={{ fill: "#1c261d" }}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(1)}%`, "vs previous month"]}
                    />
                  }
                />
                <Bar dataKey="growthPct" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {growth.map((month) => (
                    <Cell key={month.label} fill={(month.growthPct ?? 0) >= 0 ? GREEN : AMBER} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="mt-6 text-sm text-[#a9b7aa]">Growth needs two consecutive months with revenue.</p>
          )}
        </ChartCard>
      </div>

      <details className="mt-4 border border-[#53614e] text-[#e5f0e4]">
        <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em]">
          View as table
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left font-mono text-[11px]">
            <thead className="text-[#a9b7aa]">
              <tr>
                <th className="px-3 py-2 font-bold">Month</th>
                <th className="px-3 py-2 font-bold">Revenue</th>
                <th className="px-3 py-2 font-bold">Recurring</th>
                <th className="px-3 py-2 font-bold">One-time</th>
                <th className="px-3 py-2 font-bold">Cumulative</th>
                <th className="px-3 py-2 font-bold">MoM</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month.label} className="border-t border-[#53614e]/60">
                  <td className="px-3 py-1.5">{month.label}</td>
                  <td className="px-3 py-1.5">{money.format(month.revenue)}</td>
                  <td className="px-3 py-1.5">{money.format(month.recurring)}</td>
                  <td className="px-3 py-1.5">{money.format(month.oneTime)}</td>
                  <td className="px-3 py-1.5">{money.format(month.cumulative)}</td>
                  <td className="px-3 py-1.5">{month.growthPct === null ? "—" : `${month.growthPct > 0 ? "+" : ""}${month.growthPct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
