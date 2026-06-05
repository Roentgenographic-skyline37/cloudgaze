import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ExternalLink, ScrollText } from 'lucide-react'
import type { DetailSection } from '@shared/types'
import { useResourceDetail } from '../lib/query'
import { serviceById } from '@shared/services'
import { regionLabel } from '@shared/config'
import { Badge, ErrorState, Loading } from './ui'
import { Cell } from './Cell'
import { TagList } from './TagList'
import { JsonView } from './JsonView'
import { MetricsGrid } from './MetricsGrid'
import { cn } from '../lib/cn'

/**
 * For services whose CloudWatch Logs group name is predictable from the
 * resource id/name, return the group string so the detail panel can deep-link
 * into the logs viewer.
 */
function logGroupFor(serviceId: string, id: string, name?: string): string | undefined {
  if (serviceId === 'log-groups') return name ?? id
  if (serviceId === 'lambda') return `/aws/lambda/${name ?? id}`
  return undefined
}

type Tab = 'details' | 'raw'

function SectionCard({ section }: { section: DetailSection }): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{section.title}</h3>
      <dl className="space-y-0">
        {section.fields.map((f, i) => (
          <div key={i} className="flex items-start justify-between gap-4 border-b border-border/40 py-1.5 last:border-0">
            <dt className="shrink-0 text-xs text-fg-subtle">{f.label}</dt>
            <dd className="min-w-0 text-right text-sm text-fg">
              <Cell value={f.value} kind={f.kind} tone={f.tone} breakable />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function DetailPanel({
  serviceId,
  id,
  onClose
}: {
  serviceId: string
  id: string
  onClose: () => void
}): JSX.Element {
  const q = useResourceDetail(serviceId, id)
  const [tab, setTab] = useState<Tab>('details')
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-fg">{q.data?.name ?? id}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
            <span>{q.data?.type ?? serviceById(serviceId)?.label}</span>
            <span>·</span>
            <span>{regionLabel(q.data?.region ?? '')}</span>
            {q.data?.status && (
              <Badge tone={q.data.statusTone ?? 'neutral'} className="ml-1">
                {q.data.status}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {(() => {
            const group = logGroupFor(serviceId, id, q.data?.name)
            if (!group) return null
            return (
              <button
                onClick={() => navigate(`/logs/${encodeURIComponent(group)}`)}
                title={`View CloudWatch Logs for ${group}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-fg-muted transition hover:border-accent/50 hover:text-accent"
              >
                <ScrollText className="h-3.5 w-3.5" /> Logs
              </button>
            )
          })()}
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-surface-2 p-1.5 text-fg-muted transition hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-border px-4 pt-2">
        {(['details', 'raw'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-t-lg px-3 py-2 text-sm font-medium capitalize transition',
              tab === t ? 'bg-surface text-accent' : 'text-fg-muted hover:text-fg'
            )}
          >
            {t === 'raw' ? 'Raw JSON' : t}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-5">
        {q.isError ? (
          <ErrorState error={q.error} />
        ) : q.data === undefined ? (
          <Loading />
        ) : tab === 'details' ? (
          <div className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-2">
              {q.data.sections
                .filter((s) => s.fields.length > 0)
                .map((s) => (
                  <SectionCard key={s.title} section={s} />
                ))}
            </div>

            {q.data.metrics && q.data.metrics.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  Live metrics <span className="text-fg-subtle/70">· CloudWatch</span>
                </h3>
                <MetricsGrid specs={q.data.metrics} />
              </div>
            )}

            {q.data.related && q.data.related.length > 0 && (
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Related</h3>
                <div className="flex flex-wrap gap-2">
                  {q.data.related
                    .filter((r) => r.id && serviceById(r.service))
                    .map((r, i) => (
                      <button
                        key={`${r.service}-${r.id}-${i}`}
                        onClick={() => navigate(`/s/${r.service}?select=${encodeURIComponent(r.id)}`)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs text-fg-muted transition hover:border-accent/50 hover:text-accent"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="text-fg-subtle">{r.label}:</span>
                        <span className="font-mono">{r.id}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Tags</h3>
              <TagList tags={q.data.tags} />
            </div>
          </div>
        ) : (
          <JsonView value={q.data.raw} />
        )}
      </div>
    </div>
  )
}
