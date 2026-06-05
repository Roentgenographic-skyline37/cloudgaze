/**
 * Overview inventory — for each service, run its lister and summarize: a count,
 * a status breakdown (derived from the badge/status column) and a few sample
 * names. Resilient: a service the principal can't read reports its error with a
 * count of 0 rather than failing the page. Bounded concurrency keeps a wide
 * account civil.
 */
import { SERVICES } from '@shared/services'
import type { AwsCtx, InventoryBreakdown, InventoryCount, ResourceListResult } from '@shared/types'
import { errMsg } from './aws'
import { listResource } from './resources'
import { mapLimit } from './resources/util'

/** Derive a status breakdown from the first badge column, if any. */
function summarize(res: ResourceListResult): { breakdown?: InventoryBreakdown[]; samples: string[] } {
  const samples = res.rows.slice(0, 3).map((r) => r.name || r.id)
  const badgeCol = res.columns.find((c) => c.kind === 'badge')
  if (!badgeCol) return { samples }

  const map = new Map<string, InventoryBreakdown>()
  for (const r of res.rows) {
    const raw = r.cells[badgeCol.key]
    const label = raw === null || raw === undefined || raw === '' ? 'unknown' : String(raw)
    const tone = r.tones?.[badgeCol.key] ?? 'neutral'
    const existing = map.get(label)
    if (existing) existing.count += 1
    else map.set(label, { label, count: 1, tone })
  }
  const breakdown = [...map.values()].sort((a, b) => b.count - a.count)
  return { breakdown, samples }
}

/** Count one service. Never throws — errors are folded into the result. */
async function countOne(ctx: AwsCtx, service: string): Promise<InventoryCount> {
  try {
    const res = await listResource(ctx, service)
    const { breakdown, samples } = summarize(res)
    return { service, count: res.rows.length, breakdown, samples }
  } catch (e) {
    return { service, count: 0, error: errMsg(e) }
  }
}

export async function getInventory(ctx: AwsCtx, serviceIds?: string[]): Promise<InventoryCount[]> {
  const ids = serviceIds?.length ? serviceIds : SERVICES.map((s) => s.id)
  return mapLimit(ids, 5, (service) => countOne(ctx, service))
}

/**
 * Same as getInventory but emits each per-service result the moment it's ready
 * via the supplied callback, so the renderer can fill sections in
 * progressively instead of waiting for the slowest service.
 */
export async function streamInventory(
  ctx: AwsCtx,
  serviceIds: string[] | undefined,
  onCount: (c: InventoryCount) => void
): Promise<void> {
  const ids = serviceIds?.length ? serviceIds : SERVICES.map((s) => s.id)
  await mapLimit(ids, 5, async (service) => {
    const c = await countOne(ctx, service)
    try {
      onCount(c)
    } catch {
      // The consumer (a webContents) may have gone away — drop the event but
      // keep counting the rest so the stream resolves cleanly.
    }
  })
}
