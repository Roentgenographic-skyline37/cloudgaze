import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Info } from 'lucide-react'
import { serviceById } from '@shared/services'
import type { ResourceRow } from '@shared/types'
import { useResources } from '../lib/query'
import { useAppStore } from '../store/useAppStore'
import { Panel, SearchInput, QueryBoundary, DataTable, Badge, EmptyState } from '../components/ui'
import { toResourceColumns } from '../components/resourceColumns'
import { ResourceDrawer } from '../components/ResourceDrawer'

function matches(row: ResourceRow, q: string): boolean {
  if (!q) return true
  const hay: string[] = [row.id, row.name ?? '']
  for (const v of Object.values(row.cells)) if (v !== null && v !== undefined) hay.push(String(v))
  if (row.tags) for (const [k, v] of Object.entries(row.tags)) hay.push(k, v)
  return hay.join(' ').toLowerCase().includes(q)
}

export function ServiceExplorer(): JSX.Element {
  const { serviceId = '' } = useParams()
  const service = serviceById(serviceId)
  const [search, setSearch] = useState('')
  const [params, setParams] = useSearchParams()
  const region = useAppStore((s) => s.region)
  const selected = params.get('select')

  const query = useResources(serviceId)
  const columns = useMemo(() => toResourceColumns(query.data?.columns ?? []), [query.data])

  function open(id: string): void {
    setParams({ select: id })
  }
  function close(): void {
    setParams({})
  }

  if (!service) {
    return <EmptyState message={`Unknown service "${serviceId}".`} icon={<AlertTriangle className="h-6 w-6" />} />
  }

  const filtered = (query.data?.rows ?? []).filter((r) => matches(r, search.trim().toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-fg-muted">{service.description}</p>
          {query.data?.note && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-subtle">
              <Info className="h-3.5 w-3.5" /> {query.data.note}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {query.data?.truncated && <Badge tone="warn">Truncated</Badge>}
          {query.data && (
            <span className="text-xs text-fg-subtle tabular-nums">
              {filtered.length} of {query.data.rows.length} {service.noun}
            </span>
          )}
          <SearchInput value={search} onChange={setSearch} placeholder={`Filter ${service.noun}…`} className="w-64" />
        </div>
      </div>

      <Panel title={service.label} subtitle={service.scope === 'global' ? 'Global service' : region}>
        <QueryBoundary
          query={query}
          isEmpty={(d) => d.rows.length === 0}
          empty={
            <EmptyState message={`No ${service.noun} found in ${service.scope === 'global' ? 'this account' : region}.`} />
          }
        >
          {() => (
            <DataTable<ResourceRow>
              columns={columns}
              rows={filtered}
              getKey={(r) => r.id}
              onRowClick={(r) => open(r.id)}
              empty={`No ${service.noun} match your filter.`}
              pageSize={25}
            />
          )}
        </QueryBoundary>
      </Panel>

      {selected && <ResourceDrawer serviceId={serviceId} id={selected} onClose={close} />}
    </div>
  )
}
