import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/cn'

export interface SelectOption {
  value: string
  label: string
}

/** A compact, theme-styled native <select>. */
export function Select({
  value,
  onChange,
  options,
  icon,
  title,
  className
}: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  icon?: ReactNode
  title?: string
  className?: string
}): JSX.Element {
  return (
    <div className={cn('relative inline-flex items-center', className)} title={title}>
      {icon && <span className="pointer-events-none absolute left-2.5 text-fg-subtle">{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'appearance-none rounded-lg border border-border bg-surface-2 py-1.5 pr-7 text-sm text-fg-muted outline-none transition hover:bg-surface-hover focus:border-accent/60',
          icon ? 'pl-8' : 'pl-3'
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-fg">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-fg-subtle" />
    </div>
  )
}
