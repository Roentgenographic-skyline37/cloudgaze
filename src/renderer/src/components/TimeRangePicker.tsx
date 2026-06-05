import { useEffect, useRef, useState } from 'react'
import { Clock, ChevronDown } from 'lucide-react'
import { TIME_PRESETS, PRESET_LABELS, presetToRange, customRange } from '@shared/time'
import type { TimePreset } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

export function TimeRangePicker(): JSX.Element {
  const range = useAppStore((s) => s.timeRange)
  const setRange = useAppStore((s) => s.setTimeRange)
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(() => toLocalInput(range.fromIso))
  const [to, setTo] = useState(() => toLocalInput(range.toIso))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(preset: TimePreset): void {
    if (preset === 'custom') return
    setRange(presetToRange(preset))
    setOpen(false)
  }

  function applyCustom(): void {
    setRange(customRange(new Date(from), new Date(to)))
    setOpen(false)
  }

  const label = range.preset === 'custom' ? 'Custom range' : PRESET_LABELS[range.preset]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-fg-muted transition hover:bg-surface-hover"
      >
        <Clock className="h-4 w-4 text-fg-subtle" />
        {label}
        <ChevronDown className="h-4 w-4 text-fg-subtle" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-border bg-bg-elevated p-2 shadow-elevated">
          <div className="grid grid-cols-2 gap-1">
            {TIME_PRESETS.filter((p) => p !== 'custom').map((p) => (
              <button
                key={p}
                onClick={() => pick(p)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-left text-sm transition',
                  range.preset === p ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-surface-hover'
                )}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Custom</p>
            <label className="mb-1 block text-xs text-fg-subtle">
              From
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-fg outline-none focus:border-accent/60"
              />
            </label>
            <label className="mb-2 block text-xs text-fg-subtle">
              To
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-fg outline-none focus:border-accent/60"
              />
            </label>
            <button
              onClick={applyCustom}
              className="w-full rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
