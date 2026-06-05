import { useMemo, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Icons from 'lucide-react'
import type { InventoryCount, ResourceRow, Tone } from '@shared/types'
import type { ServiceMeta } from '@shared/services'
import { useResources, useServiceMetrics } from '../lib/query'
import { useInView } from '../lib/useInView'
import { Card, DataTable, ChartFrame, Loading, ErrorState } from './ui'
import { SeriesChart } from './charts'
import { toResourceColumns } from './resourceColumns'
import { cn } from '../lib/cn'

type IconProps = { className?: string }
function Icon({ name, className }: { name: string; className?: string }): JSX.Element {
  const lib = Icons as unknown as Record<string, ComponentType<IconProps>>
  const Cmp = lib[name] ?? lib.Circle
  return <Cmp className={className} />
}

const DOT_TONE: Record<Tone, string> = {
  neutral: 'bg-fg-subtle/50',
  ok: 'bg-ok',
  warn: 'bg-warn',
  error: 'bg-error',
  info: 'bg-info',
  accent: 'bg-accent'
}

export function DeployedServiceSection({
  service,
  entry,
  defaultOpen = true,
  onSelect
}: {
  service: ServiceMeta
  entry: InventoryCount
  defaultOpen?: boolean
  onSelect: (serviceId: string, id: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  const [ref, inView] = useInView<HTMLDivElement>()
  const navigate = useNavigate()

  const enabled = open && inView
  const list = useResources(service.id, enabled)
  const metrics = useServiceMetrics(service.id, enabled)

  const columns = useMemo(() => toResourceColumns(list.data?.columns ?? []), [list.data])
  const rows = list.data?.rows ?? []
  const series = (metrics.data ?? []).filter((s) => s.points.length > 0)

  return (
    <div ref={ref}>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            {open ? (
              <Icons.ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" />
            ) : (
              <Icons.ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
            )}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Icon name={service.icon} className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-fg">{service.label}</div>
              <div className="text-xs text-fg-subtle">{service.category}</div>
            </div>
          </button>

          {entry.breakdown && entry.breakdown.length > 0 && (
            <div className="hidden flex-wrap gap-x-3 gap-y-1 md:flex">
              {entry.breakdown.slice(0, 4).map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                  <span className={cn('h-2 w-2 rounded-full', DOT_TONE[b.tone])} />
                  <span className="tabular-nums font-medium text-fg">{b.count}</span>
                  <span>{b.label}</span>
                </span>
              ))}
            </div>
          )}

          <span className="ml-2 whitespace-nowrap text-fg">
            <span className="text-lg font-semibold tabular-nums">{entry.count}</span>
            <span className="ml-1 text-xs text-fg-subtle">{service.noun}</span>
          </span>
          <button
            onClick={() => navigate(`/s/${service.id}`)}
            title="Open service"
            className="rounded-lg border border-border bg-surface-2 p-1.5 text-fg-muted transition hover:bg-surface-hover hover:text-accent"
          >
            <Icons.ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        {open && (
          <div className="space-y-4 border-t border-border p-4">
            {series.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  Headline metrics <span className="text-fg-subtle/70">· across all {service.noun}</span>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {series.map((s) => (
                    <ChartFrame key={s.label} title={s.label} height={130}>
                      <SeriesChart series={s} />
                    </ChartFrame>
                  ))}
                </div>
              </div>
            )}

            {list.isError ? (
              <ErrorState error={list.error} />
            ) : list.data === undefined ? (
              <Loading />
            ) : (
              <DataTable<ResourceRow>
                columns={columns}
                rows={rows}
                getKey={(r) => r.id}
                onRowClick={(r) => onSelect(service.id, r.id)}
                dense
                pageSize={8}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
