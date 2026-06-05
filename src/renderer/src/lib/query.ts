import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import type {
  AwsCtx,
  CostSummary,
  InventoryCount,
  MetricSeries,
  MetricSpecDTO,
  ResourceDetailResult,
  ResourceListResult
} from '@shared/types'
import type { AwsIdentity } from '@shared/types'
import { api } from './ipc'
import { useAppStore } from '../store/useAppStore'

/** The active (profile, region) context driving every data call. */
export function useCtx(): AwsCtx {
  const profile = useAppStore((s) => s.profile)
  const region = useAppStore((s) => s.region)
  return { profile, region }
}

function useRefresh(): number | false {
  const ms = useAppStore((s) => s.autoRefreshMs)
  return ms > 0 ? ms : false
}

/** List one service's resources, bound to the active context + auto-refresh. */
export function useResources(serviceId: string, enabled = true): UseQueryResult<ResourceListResult> {
  const ctx = useCtx()
  const refetchInterval = useRefresh()
  return useQuery({
    queryKey: ['resources', serviceId, ctx.profile, ctx.region],
    queryFn: () => api.listResources({ ctx, service: serviceId }),
    enabled,
    refetchInterval,
    placeholderData: keepPreviousData
  })
}

/** A service's headline aggregate metrics (Deployed dashboard), lazy via enabled. */
export function useServiceMetrics(serviceId: string, enabled = true): UseQueryResult<MetricSeries[]> {
  const ctx = useCtx()
  const timeRange = useAppStore((s) => s.timeRange)
  const refetchInterval = useRefresh()
  return useQuery({
    queryKey: ['service-metrics', serviceId, ctx.profile, ctx.region, timeRange.fromIso, timeRange.toIso],
    queryFn: async () => (await api.getServiceMetrics({ ctx, service: serviceId, range: timeRange })).series,
    enabled,
    refetchInterval,
    placeholderData: keepPreviousData
  })
}

/** Full detail for one resource (only runs when an id is selected). */
export function useResourceDetail(serviceId: string, id: string | null): UseQueryResult<ResourceDetailResult> {
  const ctx = useCtx()
  return useQuery({
    queryKey: ['detail', serviceId, id, ctx.profile, ctx.region],
    queryFn: () => api.resourceDetail({ ctx, service: serviceId, id: id as string }),
    enabled: Boolean(id)
  })
}

/** CloudWatch series for a detail's metric specs, bound to the time range. */
export function useMetrics(specs: MetricSpecDTO[] | undefined): UseQueryResult<MetricSeries[]> {
  const ctx = useCtx()
  const timeRange = useAppStore((s) => s.timeRange)
  const refetchInterval = useRefresh()
  const key = (specs ?? []).map((s) => `${s.namespace}/${s.metricName}/${s.stat}`).join(',')
  return useQuery({
    queryKey: ['metrics', key, ctx.profile, ctx.region, timeRange.fromIso, timeRange.toIso],
    queryFn: async () => (await api.getMetrics({ ctx, specs: specs as MetricSpecDTO[], range: timeRange })).series,
    enabled: Boolean(specs && specs.length),
    refetchInterval,
    placeholderData: keepPreviousData
  })
}

/** Account-wide inventory counts (+ identity) for the Overview. */
export function useInventory(
  serviceIds?: string[]
): UseQueryResult<{ counts: InventoryCount[]; identity?: AwsIdentity }> {
  const ctx = useCtx()
  const refetchInterval = useRefresh()
  return useQuery({
    queryKey: ['inventory', ctx.profile, ctx.region, (serviceIds ?? []).join(',')],
    queryFn: () => api.getInventory({ ctx, services: serviceIds }),
    refetchInterval,
    placeholderData: keepPreviousData
  })
}

/** Cost Explorer summary, bound to the time range. */
export function useCost(): UseQueryResult<CostSummary> {
  const ctx = useCtx()
  const timeRange = useAppStore((s) => s.timeRange)
  return useQuery({
    queryKey: ['cost', ctx.profile, ctx.region, timeRange.fromIso, timeRange.toIso],
    queryFn: () => api.getCost({ ctx, range: timeRange }),
    placeholderData: keepPreviousData
  })
}
