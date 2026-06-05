/** Display formatting helpers, including kind-driven cell formatting. */
import type { CellKind, CellValue } from '@shared/types'

export function formatUsd(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  if (v !== 0 && Math.abs(v) < 0.01) return `$${v.toFixed(4)}`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatNumber(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return v.toLocaleString('en-US')
}

export function formatCompact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

export function formatBytes(bytes: number | null | undefined): string {
  const v = typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : 0
  if (v === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(Math.abs(v)) / Math.log(1024)), units.length - 1)
  return `${(v / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return `${v.toFixed(digits)}%`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const secs = Math.round((Date.now() - d.getTime()) / 1000)
  if (secs < 0) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function formatDuration(ms: number | null | undefined): string {
  const v = typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : 0
  if (v === 0) return '—'
  if (v < 1000) return `${Math.round(v)}ms`
  const secs = Math.floor(v / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remSecs = secs % 60
  if (mins < 60) return remSecs ? `${mins}m ${remSecs}s` : `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return remMins ? `${hrs}h ${remMins}m` : `${hrs}h`
}

/**
 * Format a generic cell/field value according to its declared CellKind. The
 * 'badge' and 'bool' kinds are rendered specially by components (with tone/
 * check icons); everything else resolves to a plain string here.
 */
export function formatByKind(value: CellValue, kind?: CellKind): string {
  if (value === null || value === undefined || value === '') return '—'
  switch (kind) {
    case 'bytes':
      return formatBytes(Number(value))
    case 'number':
      return formatNumber(Number(value))
    case 'pct':
      return formatPct(Number(value))
    case 'usd':
      return formatUsd(Number(value))
    case 'duration':
      return formatDuration(Number(value))
    case 'datetime':
      return formatDateTime(String(value))
    case 'ago':
      return timeAgo(String(value))
    case 'bool':
      return value ? 'Yes' : 'No'
    default:
      return String(value)
  }
}
