import { useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { serviceById, SERVICES, type ServiceMeta } from '@shared/services'
import { regionLabel } from '@shared/config'
import type { InventoryCount } from '@shared/types'
import { useStreamingInventory } from '../lib/query'
import { useAppStore } from '../store/useAppStore'
import { Card, StatTile, EmptyState, ErrorState } from '../components/ui'
import { DeployedServiceSection } from '../components/DeployedServiceSection'
import { ResourceDrawer } from '../components/ResourceDrawer'
import { formatNumber } from '../lib/format'

type IconProps = { className?: string }
function Icon({ name, className }: { name: string; className?: string }): JSX.Element {
  const lib = Icons as unknown as Record<string, ComponentType<IconProps>>
  const Cmp = lib[name] ?? lib.Circle
  return <Cmp className={className} />
}

function CompactTile({
  service,
  entry,
  onClick
}: {
  service: ServiceMeta
  entry?: InventoryCount
  onClick: () => void
}): JSX.Element {
  const error = Boolean(entry?.error)
  return (
    <button
      onClick={onClick}
      title={error ? entry?.error : service.description}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 text-left transition hover:border-border-strong hover:bg-surface-hover/40"
    >
      <Icon name={service.icon} className="h-4 w-4 shrink-0 text-fg-subtle" />
      <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">{service.label}</span>
      <span className="text-xs text-fg-subtle">{error ? 'no access' : '0'}</span>
    </button>
  )
}

export function Overview(): JSX.Element {
  const navigate = useNavigate()
  const region = useAppStore((s) => s.region)
  const storeIdentity = useAppStore((s) => s.identity)
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<{ service: string; id: string } | null>(null)
  const inv = useStreamingInventory(SERVICES.length)

  const identity = inv.identity ?? storeIdentity
  const withMeta = inv.counts
    .map((c) => ({ entry: c, service: serviceById(c.service) }))
    .filter((x): x is { entry: InventoryCount; service: ServiceMeta } => Boolean(x.service))

  const deployed = withMeta
    .filter((x) => !x.entry.error && x.entry.count > 0)
    .sort((a, b) => b.entry.count - a.entry.count)
  const others = withMeta.filter((x) => x.entry.error || x.entry.count === 0)

  const total = deployed.reduce((sum, x) => sum + x.entry.count, 0)
  const noAccess = inv.counts.filter((c) => c.error).length
  const scanProgress = inv.progress.total
    ? Math.round((inv.progress.done / inv.progress.total) * 100)
    : 0

  if (inv.error) {
    return (
      <div className="space-y-5">
        <ErrorState error={inv.error} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Icons.UserCircle className="h-4 w-4 text-accent" />
            {identity?.accountId ? `Account ${identity.accountId}` : 'AWS account'}
          </div>
          <div className="min-w-0 truncate font-mono text-xs text-fg-subtle" title={identity?.arn}>
            {identity?.arn ?? '—'}
          </div>
          <div className="ml-auto text-xs text-fg-muted">{regionLabel(region)}</div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Resources deployed" value={formatNumber(total)} sub={`in ${region}`} tone="accent" />
        <StatTile label="Services in use" value={formatNumber(deployed.length)} sub="with ≥ 1 resource" />
        <StatTile
          label="Services scanned"
          value={
            inv.isLoading ? (
              <span className="inline-flex items-baseline gap-1.5">
                {formatNumber(inv.progress.done)}
                <span className="text-xs text-fg-subtle">/ {inv.progress.total}</span>
              </span>
            ) : (
              formatNumber(inv.counts.length)
            )
          }
          sub={inv.isLoading ? `loading… ${scanProgress}%` : undefined}
        />
        <StatTile
          label="No access"
          value={formatNumber(noAccess)}
          sub="permission or region gaps"
          tone={noAccess ? 'warn' : 'neutral'}
        />
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
          <Icons.Boxes className="h-4 w-4 text-accent" />
          Deployed in {region}
          <span className="text-fg-subtle">· {deployed.length} services</span>
          {inv.isLoading && (
            <span className="ml-1 inline-flex items-center gap-1 text-xs text-fg-subtle">
              <Icons.Loader2 className="h-3 w-3 animate-spin" />
              {inv.progress.done} of {inv.progress.total} scanned
            </span>
          )}
        </h2>
        {deployed.length === 0 && inv.isComplete ? (
          <EmptyState
            message={`No active resources found in ${region}.`}
            hint="Switch the region in the top bar — your resources may live elsewhere. Services you lack permission for appear under “Not deployed / no access”."
          />
        ) : (
          <div className="space-y-3">
            {deployed.map((x) => (
              <DeployedServiceSection
                key={x.service.id}
                service={x.service}
                entry={x.entry}
                onSelect={(service, id) => setSelected({ service, id })}
              />
            ))}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg-muted transition hover:text-fg"
          >
            {showAll ? <Icons.ChevronDown className="h-4 w-4" /> : <Icons.ChevronRight className="h-4 w-4" />}
            Not deployed / no access
            <span className="text-fg-subtle">· {others.length}</span>
          </button>
          {showAll && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {others.map((x) => (
                <CompactTile
                  key={x.service.id}
                  service={x.service}
                  entry={x.entry}
                  onClick={() => navigate(`/s/${x.service.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <ResourceDrawer serviceId={selected.service} id={selected.id} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
