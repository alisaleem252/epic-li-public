"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
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
import {
  MAX_STORED_CHARGES,
  TRAJECTORY_METRICS,
  TRAJECTORY_RANGES,
  type ChargeTrajectories,
  type TrajectoryMetric,
  type TrajectoryRange,
} from "@/lib/charge-trajectories"

const METRIC_COLORS: Record<TrajectoryMetric, string> = {
  revenue: "#00e55b",
  mrr: "#7ef0a2",
  churn: "#ffddaf",
}

const METRIC_DESCRIPTIONS: Record<TrajectoryMetric, string> = {
  revenue: "Captured charge volume",
  mrr: "Recurring subscription charges",
  churn: "Paying customers lost between periods",
}

function metricLabel(metric: TrajectoryMetric) {
  return TRAJECTORY_METRICS.find((item) => item.key === metric)?.label ?? metric
}

function rangeLabel(range: TrajectoryRange) {
  return TRAJECTORY_RANGES.find((item) => item.key === range)?.label ?? range
}

export function TrajectoryChart({ trajectories }: { trajectories: ChargeTrajectories }) {
  const [metric, setMetric] = useState<TrajectoryMetric>("revenue")
  const [range, setRange] = useState<TrajectoryRange>("30d")

  const points = trajectories.series[range][metric]
  const currency = trajectories.currency.toUpperCase()
  const color = METRIC_COLORS[metric]
  const isChurn = metric === "churn"

  const config = useMemo<ChartConfig>(
    () => ({ value: { label: metricLabel(metric), color } }),
    [metric, color],
  )
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency],
  )
  const compactCurrencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [currency],
  )

  function formatValue(value: number) {
    return isChurn ? `${value.toFixed(1)}%` : currencyFormatter.format(value)
  }

  function formatAxis(value: number) {
    return isChurn ? `${Math.round(value)}%` : compactCurrencyFormatter.format(value)
  }

  const hasAnyCharge = trajectories.eventCount > 0
  const hasRangeValue = isChurn
    ? points.some((point) => point.value !== null)
    : points.some((point) => (point.value ?? 0) > 0)

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#a9b7aa]">
            Metric
          </span>
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as TrajectoryMetric)}
            className="mt-1 min-h-10 w-full border border-[#53614e] bg-[#0b0f0c] px-3 font-mono text-[11px] text-[#e5f0e4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e55b]"
          >
            {TRAJECTORY_METRICS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#a9b7aa]">
            Time range
          </span>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as TrajectoryRange)}
            className="mt-1 min-h-10 w-full border border-[#53614e] bg-[#0b0f0c] px-3 font-mono text-[11px] text-[#e5f0e4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e55b]"
          >
            {TRAJECTORY_RANGES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#a9b7aa]">
        <span>
          {METRIC_DESCRIPTIONS[metric]} · {rangeLabel(range)} · {currency}
        </span>
        {trajectories.truncated ? (
          <span>Newest {MAX_STORED_CHARGES.toLocaleString("en-US")} charges</span>
        ) : null}
      </div>

      {!hasAnyCharge ? (
        <div className="grid min-h-52 place-items-center py-8 text-center">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#00e55b]">
              No dated charge history
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#a9b7aa]">
              This profile has no captured charges stored yet. New profiles store dated charge history at creation.
            </p>
          </div>
        </div>
      ) : !hasRangeValue ? (
        <div className="grid min-h-52 place-items-center py-8 text-center">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#00e55b]">
              No data in this range
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#a9b7aa]">
              {isChurn
                ? "Churn needs at least two adjacent periods with paying customers."
                : "There are no captured charges in the selected time range."}
            </p>
          </div>
        </div>
      ) : (
        <ChartContainer config={config} className="mt-3 aspect-auto h-64 w-full">
          <AreaChart
            accessibilityLayer
            data={points}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#53614e" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              minTickGap={28}
              interval="preserveStartEnd"
              tick={{ fill: "#a9b7aa", fontSize: 10, fontFamily: "monospace" }}
            />
            <YAxis
              width={64}
              axisLine={false}
              tickLine={false}
              tickMargin={6}
              domain={isChurn ? [0, 100] : [0, "auto"]}
              tickFormatter={(value) => formatAxis(Number(value))}
              tick={{ fill: "#a9b7aa", fontSize: 10, fontFamily: "monospace" }}
            />
            <ChartTooltip
              cursor={{ stroke: "#53614e", strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  formatter={(value) => [formatValue(Number(value)), metricLabel(metric)]}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.18}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: "#101410", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  )
}
