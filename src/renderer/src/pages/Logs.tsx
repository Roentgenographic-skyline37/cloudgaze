/**
 * CloudWatch Logs viewer.
 *
 * One page that covers two related tasks:
 *  1) **Search** — pick a log group, type a CloudWatch filter pattern (full JSON
 *     field syntax is supported: `{ $.level = "ERROR" }`), set a time range,
 *     get results. Powered by FilterLogEvents on the main side.
 *  2) **Live tail** — toggle "Tail" to re-poll every 3 s, advancing a cursor
 *     so only NEW events arrive on each tick. Same API, just a moving start
 *     time.
 *
 * The route accepts an optional `:group` segment so other pages (Lambda
 * detail, the log-groups list) can link straight into "tail this group".
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Loader2,
  Pause,
  Play,
  Search,
  Tag,
  X
} from 'lucide-react'
import type { LogEvent } from '@shared/contract'
import { useAppStore } from '../store/useAppStore'
import { api } from '../lib/ipc'
import { useCtx } from '../lib/query'
import { Card, Panel, Toolbar, Badge, EmptyState, ErrorState, Loading, Spinner } from '../components/ui'
import { TimeRangePicker } from '../components/TimeRangePicker'
import { cn } from '../lib/cn'

const TAIL_INTERVAL_MS = 3000
const TAIL_BUFFER_CAP = 5000 // never accumulate more than this in memory

// ---------------------------------------------------------------------------
// Group picker — lists CloudWatch log groups for the current (profile, region)
// via the existing log-groups inventory lister, so we don't need a new IPC.
// ---------------------------------------------------------------------------

function useLogGroups(): { groups: string[]; isLoading: boolean; error?: string } {
  const ctx = useCtx()
  const [groups, setGroups] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(undefined)
    api
      .listResources({ ctx, service: 'log-groups' })
      .then((res) => {
        if (cancelled) return
        const names = res.rows
          .map((r) => r.name || r.id)
          .filter((n): n is string => Boolean(n))
          .sort()
        setGroups(names)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ctx.profile, ctx.region])

  return { groups, isLoading, error }
}

// ---------------------------------------------------------------------------
// Field-aware filter pattern help — shown in a popover.
// ---------------------------------------------------------------------------

const PATTERN_EXAMPLES: { example: string; explain: string }[] = [
  { example: 'ERROR', explain: 'Lines containing the literal token ERROR.' },
  { example: 'ERROR -Debug', explain: 'ERROR but NOT lines containing Debug.' },
  { example: '"connection refused"', explain: 'Exact phrase (use quotes for spaces).' },
  { example: '{ $.level = "ERROR" }', explain: 'JSON logs: field `level` equals "ERROR".' },
  { example: '{ $.statusCode >= 500 }', explain: 'JSON logs: numeric comparison.' },
  { example: '{ $.user.id = "u_42" }', explain: 'JSON logs: nested fields with dot path.' },
  { example: '{ $.tags[0] = "billing" }', explain: 'JSON logs: array indexing.' }
]

function PatternHelp({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div className="absolute right-0 top-full z-30 mt-2 w-[28rem] rounded-xl border border-border bg-bg-elevated p-4 shadow-elevated">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">CloudWatch filter pattern</h3>
        <button onClick={onClose} className="text-fg-subtle hover:text-fg" aria-label="Close help">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-3 text-xs text-fg-muted">
        Same syntax as the AWS Console. Plain terms match literally; quoted phrases stay together; a leading{' '}
        <code className="font-mono">-</code> excludes. For JSON-structured logs, use{' '}
        <code className="font-mono">{'{ $.field op value }'}</code> selectors.
      </p>
      <div className="space-y-1.5">
        {PATTERN_EXAMPLES.map((p) => (
          <div key={p.example} className="rounded-lg bg-surface-2 px-2.5 py-1.5">
            <code className="block font-mono text-[11px] text-accent">{p.example}</code>
            <span className="text-[11px] text-fg-subtle">{p.explain}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One log event row — dense by default; click to expand fields/raw JSON.
// ---------------------------------------------------------------------------

const LEVEL_TONE: Record<string, 'ok' | 'warn' | 'error' | 'info' | 'neutral'> = {
  error: 'error',
  fatal: 'error',
  critical: 'error',
  warn: 'warn',
  warning: 'warn',
  info: 'info',
  debug: 'neutral',
  trace: 'neutral'
}

function detectLevel(ev: LogEvent): string | undefined {
  const f = ev.fields
  const candidates = [f?.level, f?.severity, f?.lvl, f?.log_level]
  for (const c of candidates) if (typeof c === 'string') return c.toLowerCase()
  const m = ev.message.match(/\b(ERROR|FATAL|CRITICAL|WARN(?:ING)?|INFO|DEBUG|TRACE)\b/)
  return m ? m[1].toLowerCase() : undefined
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function LogRow({
  ev,
  open,
  onToggle,
  onPick
}: {
  ev: LogEvent
  open: boolean
  onToggle: () => void
  onPick: (key: string, value: string) => void
}): JSX.Element {
  const level = detectLevel(ev)
  const tone = level ? LEVEL_TONE[level] ?? 'neutral' : 'neutral'
  const preview = ev.message.length > 240 ? ev.message.slice(0, 240) + '…' : ev.message

  return (
    <Fragment>
      <tr
        onClick={onToggle}
        className={cn(
          'cursor-pointer border-b border-border/60 transition hover:bg-surface-hover/60',
          open && 'bg-surface-hover/40'
        )}
      >
        <td className="w-6 px-2 align-top">
          {open ? (
            <ChevronDown className="mt-1 h-3.5 w-3.5 text-fg-subtle" />
          ) : (
            <ChevronRight className="mt-1 h-3.5 w-3.5 text-fg-subtle" />
          )}
        </td>
        <td className="whitespace-nowrap px-2 py-1.5 align-top font-mono text-[11px] tabular-nums text-fg-subtle">
          <div>{fmtTime(ev.ts)}</div>
          <div className="text-[10px] text-fg-subtle/70">{fmtDate(ev.ts)}</div>
        </td>
        <td className="w-16 px-2 align-top">
          {level && <Badge tone={tone}>{level}</Badge>}
        </td>
        <td className="px-2 py-1.5 align-top text-xs text-fg-muted">
          <div className="break-words font-mono leading-relaxed">{preview}</div>
          <div className="mt-0.5 truncate text-[10px] text-fg-subtle">{ev.stream}</div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border/60 bg-surface-2/40">
          <td colSpan={4} className="border-l-2 border-accent/60 p-3">
            {ev.fields ? (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Fields</div>
                <div className="grid gap-1 text-xs sm:grid-cols-2">
                  {Object.entries(ev.fields).map(([k, v]) => {
                    const val = typeof v === 'string' ? v : JSON.stringify(v)
                    return (
                      <div key={k} className="flex items-start gap-2 rounded-md bg-surface-2 px-2 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onPick(k, val)
                          }}
                          title={`Filter by ${k}=${val}`}
                          className="mt-0.5 text-fg-subtle transition hover:text-accent"
                        >
                          <Tag className="h-3 w-3" />
                        </button>
                        <span className="font-mono text-[11px] text-accent">{k}</span>
                        <span className="font-mono text-[11px] text-fg-muted break-all">{val}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Message</div>
            <pre className="mt-1 max-h-80 overflow-auto rounded-md bg-bg-elevated p-2 font-mono text-[11px] text-fg-muted">
              {ev.message}
            </pre>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function Logs(): JSX.Element {
  const navigate = useNavigate()
  const params = useParams<{ group?: string }>()
  const [searchParams] = useSearchParams()
  const ctx = useCtx()
  const timeRange = useAppStore((s) => s.timeRange)

  // Decode the URL group (it was encodeURIComponent'd when we built the link).
  const urlGroup = params.group ? decodeURIComponent(params.group) : ''
  const [group, setGroup] = useState<string>(urlGroup)
  const [pattern, setPattern] = useState<string>(searchParams.get('q') ?? '')
  const [tail, setTail] = useState<boolean>(searchParams.get('tail') === '1')
  const [showHelp, setShowHelp] = useState(false)
  const [events, setEvents] = useState<LogEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [truncated, setTruncated] = useState(false)
  const [lastFetchTs, setLastFetchTs] = useState<number | undefined>()

  const { groups, isLoading: groupsLoading, error: groupsError } = useLogGroups()

  // Keep URL ↔ state in sync when group is picked.
  useEffect(() => {
    if (group && group !== urlGroup) {
      navigate(`/logs/${encodeURIComponent(group)}`, { replace: true })
    }
  }, [group, urlGroup, navigate])

  // Single-shot fetch — for search and the initial tail snapshot.
  const fetchOnce = useCallback(
    async (opts: { since?: string }) => {
      if (!group) return
      setIsLoading(true)
      setError(undefined)
      try {
        const res = await api.filterLogs({
          ctx,
          group,
          fromIso: timeRange.fromIso,
          toIso: timeRange.toIso,
          pattern: pattern.trim() || undefined,
          sinceEventId: opts.since,
          limit: 1000
        })
        setEvents((prev) => {
          if (!opts.since) return res.events
          // Tail mode: prepend new events (they arrive newest-first), cap total.
          const merged = [...res.events, ...prev]
          return merged.slice(0, TAIL_BUFFER_CAP)
        })
        setTruncated(res.truncated)
        setLastFetchTs(Date.now())
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setIsLoading(false)
      }
    },
    [ctx, group, pattern, timeRange.fromIso, timeRange.toIso]
  )

  // Clear events when group/profile/region/pattern/range change so old results
  // don't linger when the user adjusts the query.
  useEffect(() => {
    setEvents([])
    setOpenIds(new Set())
  }, [group, ctx.profile, ctx.region, pattern, timeRange.fromIso, timeRange.toIso])

  // Tail loop — polls every TAIL_INTERVAL_MS using the newest event's id as the
  // cursor so we only fetch *new* events.
  const newestIdRef = useRef<string | undefined>()
  newestIdRef.current = events[0]?.id

  useEffect(() => {
    if (!tail || !group) return
    let cancelled = false
    // Fire one immediate fetch on toggle, then poll.
    void fetchOnce({ since: newestIdRef.current })
    const handle = setInterval(() => {
      if (cancelled) return
      void fetchOnce({ since: newestIdRef.current })
    }, TAIL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(handle)
    }
  }, [tail, group, fetchOnce])

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (!group) return
    void fetchOnce({})
  }

  function pickField(key: string, value: string): void {
    const q = `{ $.${key} = "${value.replace(/"/g, '\\"')}" }`
    setPattern(q)
    void fetchOnce({})
  }

  const visible = useMemo(() => events, [events])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Group + filter toolbar */}
      <Card className="p-3">
        <Toolbar className="gap-3">
          <select
            value={group}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setGroup(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-fg outline-none transition focus:border-accent/60"
            disabled={groupsLoading}
          >
            <option value="">{groupsLoading ? 'Loading log groups…' : 'Pick a log group…'}</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <form onSubmit={onSubmit} className="relative flex min-w-[18rem] flex-1 items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
              <input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder={'Filter pattern · plain terms or { $.field = "value" } for JSON'}
                spellCheck={false}
                className="w-full rounded-lg border border-border bg-surface-2 py-1.5 pl-8 pr-9 font-mono text-xs text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                title="Filter pattern help"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle transition hover:text-accent"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              {showHelp && <PatternHelp onClose={() => setShowHelp(false)} />}
            </div>
            <button
              type="submit"
              disabled={!group || isLoading}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
            >
              {isLoading ? <Spinner /> : 'Search'}
            </button>
          </form>

          <TimeRangePicker />

          <button
            onClick={() => setTail((v) => !v)}
            disabled={!group}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition disabled:opacity-50',
              tail
                ? 'bg-accent-soft text-accent'
                : 'bg-surface-2 text-fg-muted hover:bg-surface-hover'
            )}
            title={tail ? 'Pause live tail' : 'Live tail (poll every 3 s)'}
          >
            {tail ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {tail ? 'Tailing' : 'Tail'}
          </button>
        </Toolbar>
      </Card>

      {/* Results */}
      <Panel
        title={group ? group : 'CloudWatch Logs'}
        subtitle={
          group
            ? `${visible.length.toLocaleString('en-US')} events${truncated ? ' (capped at 1,000)' : ''}${
                tail && lastFetchTs ? ` · live · last fetch ${new Date(lastFetchTs).toLocaleTimeString('en-US', { hour12: false })}` : ''
              }`
            : 'Pick a log group above to start.'
        }
        right={
          isLoading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching…
            </span>
          ) : undefined
        }
        bodyClassName="p-0"
      >
        {groupsError ? (
          <div className="p-4">
            <ErrorState error={groupsError} />
          </div>
        ) : !group ? (
          <EmptyState
            message="No log group selected."
            hint="CloudGaze reads from CloudWatch Logs. EC2, Lambda, ECS, RDS — anything streaming to a log group can be searched here."
          />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} />
          </div>
        ) : isLoading && visible.length === 0 ? (
          <Loading label="Fetching log events…" />
        ) : visible.length === 0 ? (
          <EmptyState
            message="No events in this window."
            hint="Widen the time range, clear the filter pattern, or pick a busier log group."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-fg-subtle">
                  <th className="w-6 px-2 py-2"></th>
                  <th className="px-2 py-2 font-medium">Time</th>
                  <th className="px-2 py-2 font-medium">Level</th>
                  <th className="px-2 py-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((ev) => (
                  <LogRow
                    key={ev.id}
                    ev={ev}
                    open={openIds.has(ev.id)}
                    onToggle={() =>
                      setOpenIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(ev.id)) next.delete(ev.id)
                        else next.add(ev.id)
                        return next
                      })
                    }
                    onPick={pickField}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
