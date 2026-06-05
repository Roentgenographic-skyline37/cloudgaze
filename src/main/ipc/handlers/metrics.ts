/** Metrics handler — generic CloudWatch GetMetricData for arbitrary specs. */
import type { IpcMain } from 'electron'
import { CHANNELS } from '@shared/contract'
import type { MetricsReq, MetricsRes, ServiceMetricsReq } from '@shared/contract'
import { getMetrics } from '../../services/metrics'
import { headlineMetrics } from '../../services/headline'

export function registerMetricsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(CHANNELS.metrics.get, async (_e, req: MetricsReq): Promise<MetricsRes> => {
    return { series: await getMetrics(req.ctx, req.specs, req.range) }
  })

  ipcMain.handle(CHANNELS.metrics.service, async (_e, req: ServiceMetricsReq): Promise<MetricsRes> => {
    const specs = headlineMetrics(req.service)
    return { series: specs.length ? await getMetrics(req.ctx, specs, req.range) : [] }
  })
}
