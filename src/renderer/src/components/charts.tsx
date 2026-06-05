import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import type { MetricSeries } from '@shared/types'
import { formatBytes, formatNumber } from '../lib/format'

export const CHART_COLORS = {
  accent: '#38bdf8',
  cyan: '#22d3ee',
  ok: '#34c78e',
  info: '#60a5fa',
  warn: '#f0b840',
  error: '#f4636e'
}

export function fmtForUnit(unit: string): (v: number) => string {
  const u = unit.toLowerCase()
  if (u.includes('percent')) return (v) => `${v.toFixed(1)}%`
  if (u.includes('bytes/second')) return (v) => `${formatBytes(v)}/s`
  if (u.includes('bytes')) return (v) => formatBytes(v)
  if (u.includes('seconds')) return (v) => `${(v * 1000).toFixed(1)}ms`
  if (u.includes('milliseconds')) return (v) => `${v.toFixed(0)}ms`
  return (v) => formatNumber(Math.round(v * 100) / 100)
}

function shortTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function shortDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TOOLTIP_STYLE = {
  background: 'rgb(var(--bg-elevated))',
  border: '1px solid rgb(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'rgb(var(--fg))'
} as const

export function MetricArea({
  points,
  color = CHART_COLORS.accent,
  valueFmt = (v: number) => formatNumber(v),
  xFmt = shortTime
}: {
  points: { t: string; v: number }[]
  color?: string
  valueFmt?: (v: number) => string
  xFmt?: (s: string) => string
}): JSX.Element {
  const gid = `g-${color.replace('#', '')}`
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" tickFormatter={xFmt} tick={{ fontSize: 11 }} minTickGap={32} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => valueFmt(Number(v))}
          tick={{ fontSize: 11 }}
          width={56}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(l) => xFmt(String(l))}
          formatter={(v) => [valueFmt(Number(v)), '']}
        />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gid})`} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Render a CloudWatch MetricSeries with unit-aware formatting. */
export function SeriesChart({ series, color }: { series: MetricSeries; color?: string }): JSX.Element {
  return <MetricArea points={series.points} color={color} valueFmt={fmtForUnit(series.unit)} />
}

/** A simple USD-over-time area (Cost page). */
export function CostTrendChart({ points }: { points: { t: string; amountUsd: number }[] }): JSX.Element {
  const data = points.map((p) => ({ t: p.t, v: p.amountUsd }))
  return <MetricArea points={data} color={CHART_COLORS.accent} valueFmt={(v) => `$${v.toFixed(2)}`} xFmt={shortDay} />
}
