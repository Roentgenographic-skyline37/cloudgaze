import { Check, X, Minus } from 'lucide-react'
import type { CellKind, CellValue, Tone } from '@shared/types'
import { formatByKind } from '../lib/format'
import { Badge } from './ui'
import { cn } from '../lib/cn'

/**
 * Render a generic CellValue according to its CellKind. Used by both the
 * resource table and the detail panel, so every service renders consistently
 * without per-service UI code.
 */
export function Cell({
  value,
  kind,
  tone,
  breakable
}: {
  value: CellValue
  kind?: CellKind
  tone?: Tone
  /** Allow long mono/arn values to wrap (detail panel) vs. clip (table). */
  breakable?: boolean
}): JSX.Element {
  if (kind === 'badge') {
    if (value === null || value === undefined || value === '') return <span className="text-fg-subtle">—</span>
    return <Badge tone={tone ?? 'neutral'}>{String(value)}</Badge>
  }

  if (kind === 'bool') {
    if (value === null || value === undefined) return <Minus className="h-3.5 w-3.5 text-fg-subtle" />
    return value ? <Check className="h-4 w-4 text-ok" /> : <X className="h-4 w-4 text-fg-subtle" />
  }

  const str = formatByKind(value, kind)
  if (str === '—') return <span className="text-fg-subtle">—</span>

  const mono = kind === 'mono' || kind === 'arn'
  return <span className={cn(mono && 'font-mono text-xs', breakable && 'break-all')}>{str}</span>
}
