import { Info } from 'lucide-react'
import type { CostDatum } from '@shared/types'
import { useCost } from '../lib/query'
import { Panel, StatTile, QueryBoundary, ChartFrame, DataTable, EmptyState, type Column } from '../components/ui'
import { CostTrendChart } from '../components/charts'
import { formatUsd } from '../lib/format'

const COLUMNS: Column<CostDatum>[] = [
  { key: 'label', header: 'Service', sortValue: (r) => r.label, render: (r) => <span className="text-fg">{r.label}</span> },
  {
    key: 'amount',
    header: 'Cost',
    align: 'right',
    sortValue: (r) => r.amountUsd,
    render: (r) => <span className="tabular-nums text-fg">{formatUsd(r.amountUsd)}</span>
  }
]

export function Cost(): JSX.Element {
  const cost = useCost()

  return (
    <div className="space-y-5">
      <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
        <Info className="h-3.5 w-3.5" /> Account-wide unblended cost from Cost Explorer (all regions). Each query bills ~$0.01.
      </p>

      <QueryBoundary query={cost}>
        {(data) => {
          if (!data.available) {
            return (
              <EmptyState
                message="Cost Explorer isn't available for this account."
                hint={
                  data.error
                    ? `${data.error}. Enable Cost Explorer in the Billing console and grant ce:GetCostAndUsage.`
                    : 'Enable Cost Explorer in the Billing console and grant ce:GetCostAndUsage.'
                }
              />
            )
          }
          const top = data.byService.slice(0, 12)
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Total" value={formatUsd(data.totalUsd)} sub={`${data.start} → ${data.end}`} tone="accent" />
                <StatTile label="Granularity" value={data.granularity} />
                <StatTile label="Services" value={String(data.byService.length)} />
                <StatTile
                  label="Top service"
                  value={data.byService[0] ? formatUsd(data.byService[0].amountUsd) : '—'}
                  sub={data.byService[0]?.label}
                />
              </div>

              <ChartFrame title="Spend over time" height={260}>
                <CostTrendChart points={data.trend} />
              </ChartFrame>

              <Panel title="By service" subtitle="Top services by spend in range">
                <DataTable<CostDatum> columns={COLUMNS} rows={top} getKey={(r) => r.label} paginated={false} />
              </Panel>
            </>
          )
        }}
      </QueryBoundary>
    </div>
  )
}
