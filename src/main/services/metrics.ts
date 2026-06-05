/**
 * Generic CloudWatch metrics. A detailer hands us a set of MetricSpecDTOs
 * (namespace + metric + stat + dimensions) and we return one MetricSeries per
 * spec — so ANY service can surface charts without bespoke wiring.
 *
 * CloudWatch retains metric data for ~15 months at negligible cost, so these
 * power both live and look-back views.
 */
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch'
import { getClient } from './aws'
import type { AwsCtx, MetricSeries, MetricSpecDTO, TimeRange } from '@shared/types'

/** Choose a CloudWatch period (s) that keeps the series readable for the span. */
function periodFor(fromIso: string, toIso: string): number {
  const span = (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000
  if (span <= 3 * 3600) return 60
  if (span <= 12 * 3600) return 300
  if (span <= 72 * 3600) return 900
  if (span <= 14 * 86400) return 3600
  return 21600
}

export async function getMetrics(
  ctx: AwsCtx,
  specs: MetricSpecDTO[],
  range: TimeRange
): Promise<MetricSeries[]> {
  if (!specs.length) return []
  const cw = getClient(CloudWatchClient, ctx)
  const period = periodFor(range.fromIso, range.toIso)

  const queries = specs.map((s, i) => {
    // Metric-math / SEARCH expression (service-level aggregates).
    if (s.expression) {
      return {
        Id: `m${i}`,
        Label: s.label,
        ReturnData: true,
        Expression: s.expression.replace(/__PERIOD__/g, String(period))
      }
    }
    // A single metric (per-resource detail).
    return {
      Id: `m${i}`,
      Label: s.label,
      ReturnData: true,
      MetricStat: {
        Metric: {
          Namespace: s.namespace,
          MetricName: s.metricName,
          Dimensions: (s.dimensions ?? []).map((d) => ({ Name: d.name, Value: d.value }))
        },
        Period: period,
        Stat: s.stat
      }
    }
  })

  const merged: Record<string, MetricSeries> = {}
  let token: string | undefined
  do {
    const res = await cw.send(
      new GetMetricDataCommand({
        StartTime: new Date(range.fromIso),
        EndTime: new Date(range.toIso),
        ScanBy: 'TimestampAscending',
        MetricDataQueries: queries,
        NextToken: token
      })
    )
    for (const r of res.MetricDataResults ?? []) {
      const id = r.Id ?? 'm0'
      const idx = Number(id.slice(1)) || 0
      const spec = specs[idx]
      if (!merged[id]) merged[id] = { label: r.Label ?? spec.label, unit: spec.unit ?? '', points: [] }
      const stamps = r.Timestamps ?? []
      const values = r.Values ?? []
      for (let j = 0; j < stamps.length; j++) {
        merged[id].points.push({ t: new Date(stamps[j]).toISOString(), v: values[j] ?? 0 })
      }
    }
    token = res.NextToken
  } while (token)

  return specs.map((s, i) => {
    const m = merged[`m${i}`]
    if (!m) return { label: s.label, unit: s.unit ?? '', points: [] }
    m.points.sort((a, b) => (a.t < b.t ? -1 : 1))
    return m
  })
}
