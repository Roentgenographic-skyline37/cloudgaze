/**
 * AWS Cost Explorer summary. Optional and gracefully degrading: if Cost
 * Explorer isn't enabled or the principal lacks `ce:GetCostAndUsage`, we
 * return { available: false } rather than failing the page.
 *
 * Note: Cost Explorer is a global service (us-east-1 endpoint) and each query
 * costs $0.01 against your bill.
 */
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer'
import { getClient, errMsg } from './aws'
import type { AwsCtx, CostSummary, CostDatum, CostTrendPoint, TimeRange } from '@shared/types'

function dateOnly(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function getCost(ctx: AwsCtx, range: TimeRange): Promise<CostSummary> {
  const spanDays = (new Date(range.toIso).getTime() - new Date(range.fromIso).getTime()) / 86400000
  const granularity: 'DAILY' | 'MONTHLY' = spanDays > 92 ? 'MONTHLY' : 'DAILY'

  const start = dateOnly(range.fromIso)
  // Cost Explorer's End is exclusive — bump it a day so "today" is included.
  let end = addDays(dateOnly(range.toIso), 1)
  if (end <= start) end = addDays(start, 1)

  const empty: CostSummary = {
    available: false,
    totalUsd: 0,
    granularity,
    trend: [],
    byService: [],
    currency: 'USD',
    start,
    end
  }

  try {
    const ce = getClient(CostExplorerClient, ctx, { global: true })
    const res = await ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: granularity,
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }]
      })
    )

    const trend: CostTrendPoint[] = []
    const byServiceMap = new Map<string, number>()
    let currency = 'USD'
    let total = 0

    for (const period of res.ResultsByTime ?? []) {
      let periodTotal = 0
      for (const g of period.Groups ?? []) {
        const svc = g.Keys?.[0] ?? 'Unknown'
        const amt = Number(g.Metrics?.UnblendedCost?.Amount ?? 0)
        if (g.Metrics?.UnblendedCost?.Unit) currency = g.Metrics.UnblendedCost.Unit
        periodTotal += amt
        byServiceMap.set(svc, (byServiceMap.get(svc) ?? 0) + amt)
      }
      total += periodTotal
      trend.push({ t: period.TimePeriod?.Start ?? start, amountUsd: periodTotal })
    }

    const byService: CostDatum[] = [...byServiceMap.entries()]
      .map(([label, amountUsd]) => ({ label, amountUsd }))
      .sort((a, b) => b.amountUsd - a.amountUsd)

    return { available: true, totalUsd: total, granularity, trend, byService, currency, start, end }
  } catch (e) {
    return { ...empty, error: errMsg(e) }
  }
}
