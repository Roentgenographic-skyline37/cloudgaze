import type { MetricSpecDTO } from '@shared/types'
import { useMetrics } from '../lib/query'
import { ChartFrame, EmptyState, Loading, ErrorState } from './ui'
import { SeriesChart } from './charts'

/** Fetch + render a resource's CloudWatch metric specs as a chart grid. */
export function MetricsGrid({ specs }: { specs: MetricSpecDTO[] }): JSX.Element {
  const q = useMetrics(specs)

  if (q.isError) return <ErrorState error={q.error} />
  if (q.data === undefined) return <Loading label="Loading metrics…" />

  const series = q.data.filter((s) => s.points.length > 0)
  if (!series.length) {
    return (
      <EmptyState
        message="No metric data in this time range."
        hint="The resource may be idle, or CloudWatch hasn't published points for this window. Try widening the time range."
      />
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {series.map((s) => (
        <ChartFrame key={s.label} title={s.label} height={170}>
          <SeriesChart series={s} />
        </ChartFrame>
      ))}
    </div>
  )
}
