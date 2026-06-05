import type { TimePreset, TimeRange } from './types'

/** All selectable presets for the global time-range picker. */
export const TIME_PRESETS: TimePreset[] = ['15m', '1h', '6h', '24h', '7d', '30d', 'custom']

/** Human labels for each preset. */
export const PRESET_LABELS: Record<TimePreset, string> = {
  '15m': 'Last 15 min',
  '1h': 'Last 1 hour',
  '6h': 'Last 6 hours',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom'
}

/** Duration of each non-custom preset, in milliseconds. */
const PRESET_MS: Record<Exclude<TimePreset, 'custom'>, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
}

/**
 * Resolve a preset to a concrete {fromIso, toIso} window ending now.
 * For 'custom' we default to the last 24h; callers that support custom
 * ranges supply their own from/to and keep preset='custom'.
 */
export function presetToRange(preset: TimePreset): TimeRange {
  const now = new Date()
  const toIso = now.toISOString()
  const spanMs = preset === 'custom' ? PRESET_MS['24h'] : PRESET_MS[preset]
  const fromIso = new Date(now.getTime() - spanMs).toISOString()
  return { fromIso, toIso, preset }
}

/** Build a custom range from two Date values, clamped so from <= to. */
export function customRange(from: Date, to: Date): TimeRange {
  const lo = from.getTime() <= to.getTime() ? from : to
  const hi = from.getTime() <= to.getTime() ? to : from
  return { fromIso: lo.toISOString(), toIso: hi.toISOString(), preset: 'custom' }
}

/** Span of a range in seconds (used to derive CloudWatch period + throughput). */
export function rangeSpanSec(range: TimeRange): number {
  return Math.max(1, (new Date(range.toIso).getTime() - new Date(range.fromIso).getTime()) / 1000)
}
