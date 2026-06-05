import { Fragment, useMemo, useState, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Loader2, Search, Inbox, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import type { Tone } from '@shared/types'
import { cn } from '../lib/cn'

// --- containers -------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }): JSX.Element {
  return <div className={cn('rounded-xl border border-border bg-surface shadow-card', className)}>{children}</div>
}

export function Panel({
  title,
  subtitle,
  right,
  className,
  bodyClassName,
  children
}: {
  title?: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}): JSX.Element {
  return (
    <section className={cn('rounded-xl border border-border bg-surface shadow-card', className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-fg">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-fg-subtle">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

// --- stat tile --------------------------------------------------------------

const TEXT_TONE: Record<Tone, string> = {
  neutral: 'text-fg',
  ok: 'text-ok',
  warn: 'text-warn',
  error: 'text-error',
  info: 'text-info',
  accent: 'text-accent'
}

export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
  onClick
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  tone?: Tone
  icon?: ReactNode
  onClick?: () => void
}): JSX.Element {
  return (
    <Card
      className={cn(
        'p-4 transition',
        onClick && 'cursor-pointer hover:border-border-strong hover:bg-surface-hover/40'
      )}
    >
      <div onClick={onClick}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
          {icon && <span className="text-fg-subtle">{icon}</span>}
        </div>
        <div className={cn('mt-2 text-2xl font-semibold tabular-nums', TEXT_TONE[tone])}>{value}</div>
        {sub && <div className="mt-1 text-xs text-fg-muted">{sub}</div>}
      </div>
    </Card>
  )
}

// --- badge ------------------------------------------------------------------

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-fg-muted border-border',
  ok: 'bg-ok-soft text-ok border-ok/30',
  warn: 'bg-warn-soft text-warn border-warn/30',
  error: 'bg-error-soft text-error border-error/30',
  info: 'bg-info-soft text-info border-info/30',
  accent: 'bg-accent-soft text-accent border-accent/40'
}

export function Badge({
  tone = 'neutral',
  children,
  className
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        BADGE_TONE[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

// --- inputs -----------------------------------------------------------------

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}): JSX.Element {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface-2 py-1.5 pl-8 pr-3 text-sm text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
      />
    </div>
  )
}

// --- states -----------------------------------------------------------------

export function Spinner({ className }: { className?: string }): JSX.Element {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-fg-subtle', className)} />
}

export function Loading({ label = 'Loading…' }: { label?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-fg-subtle">
      <Spinner /> {label}
    </div>
  )
}

export function EmptyState({
  message = 'Nothing here yet.',
  icon,
  hint
}: {
  message?: string
  icon?: ReactNode
  hint?: ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-fg-subtle">
      <div className="opacity-70">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="text-sm">{message}</p>
      {hint && <p className="max-w-md text-xs text-fg-subtle/80">{hint}</p>}
    </div>
  )
}

export function ErrorState({ error }: { error: unknown }): JSX.Element {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div className="rounded-lg border border-error/30 bg-error-soft px-4 py-3 text-sm text-error">
      {msg || 'Something went wrong.'}
    </div>
  )
}

/** Render loading / error / empty / data states for a react-query result. */
export function QueryBoundary<T>({
  query,
  children,
  isEmpty,
  empty
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
}): JSX.Element {
  if (query.isError) return <ErrorState error={query.error} />
  if (query.data === undefined) return <Loading />
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyState />}</>
  return <>{children(query.data)}</>
}

// --- chart frame ------------------------------------------------------------

export function ChartFrame({
  title,
  right,
  height = 220,
  children
}: {
  title?: ReactNode
  right?: ReactNode
  height?: number
  children: ReactNode
}): JSX.Element {
  return (
    <Panel title={title} right={right} bodyClassName="pt-3">
      <div style={{ width: '100%', height }}>{children}</div>
    </Panel>
  )
}

// --- data table -------------------------------------------------------------

export interface Column<T> {
  key: string
  header: ReactNode
  render?: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'right'
  /** Provide to make the column sortable; returns the comparable raw value. */
  sortValue?: (row: T) => string | number | boolean | null
}

const PAGE_SIZES = [10, 25, 50, 100] as const

function compare(a: string | number | boolean | null, b: string | number | boolean | null): number {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'en-US', { numeric: true })
}

export function DataTable<T>({
  columns,
  rows,
  getKey,
  empty = 'No rows.',
  dense,
  onRowClick,
  expandedKey,
  renderExpanded,
  paginated = true,
  pageSize = 25
}: {
  columns: Column<T>[]
  rows: T[]
  getKey: (row: T, i: number) => string
  empty?: string
  dense?: boolean
  onRowClick?: (row: T) => void
  expandedKey?: string | null
  renderExpanded?: (row: T) => ReactNode
  paginated?: boolean
  pageSize?: number
}): JSX.Element {
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(pageSize)
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    return [...rows].sort((a, b) => compare(col.sortValue!(a), col.sortValue!(b)) * sort.dir)
  }, [rows, sort, columns])

  if (!rows.length) return <EmptyState message={empty} />

  const total = sorted.length
  const pageCount = paginated ? Math.max(1, Math.ceil(total / size)) : 1
  const current = Math.min(page, pageCount - 1)
  const start = paginated ? current * size : 0
  const visible = paginated ? sorted.slice(start, start + size) : sorted
  const showFooter = paginated && total > size

  function toggleSort(key: string): void {
    setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }))
    setPage(0)
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-fg-subtle">
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    onClick={c.sortValue ? () => toggleSort(c.key) : undefined}
                    className={cn(
                      'px-3 py-2 font-medium',
                      c.align === 'right' && 'text-right',
                      c.sortValue && 'cursor-pointer select-none hover:text-fg-muted',
                      c.className
                    )}
                  >
                    <span className={cn('inline-flex items-center gap-1', c.align === 'right' && 'flex-row-reverse')}>
                      {c.header}
                      {active &&
                        (sort?.dir === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const key = getKey(row, start + i)
              const open = !!renderExpanded && expandedKey != null && expandedKey === key
              return (
                <Fragment key={key}>
                  <tr
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-border/60 transition-colors hover:bg-surface-hover/60',
                      onRowClick && 'cursor-pointer',
                      open && 'bg-surface-hover/40'
                    )}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          dense ? 'px-3 py-1.5' : 'px-3 py-2.5',
                          'align-top text-fg-muted',
                          c.align === 'right' && 'text-right tabular-nums',
                          c.className
                        )}
                      >
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                  {open && (
                    <tr className="border-b border-border/60">
                      <td colSpan={columns.length} className="p-0">
                        <div className="border-l-2 border-accent/60 bg-surface-2/40 px-4 py-3">{renderExpanded(row)}</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {showFooter && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-fg-subtle">
          <span className="tabular-nums">
            {start + 1}–{Math.min(start + size, total)} of {total.toLocaleString('en-US')}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span>Rows</span>
              <select
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value))
                  setPage(0)
                }}
                className="rounded-md border border-border bg-surface-2 px-1.5 py-1 text-fg-muted outline-none"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s} className="bg-surface text-fg">
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={current === 0}
                className="rounded-md border border-border bg-surface-2 p-1 transition enabled:hover:bg-surface-hover disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[5rem] text-center tabular-nums">
                Page {current + 1} / {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={current >= pageCount - 1}
                className="rounded-md border border-border bg-surface-2 p-1 transition enabled:hover:bg-surface-hover disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
