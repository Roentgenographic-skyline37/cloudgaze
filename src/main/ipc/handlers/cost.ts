/** Cost handler — Cost Explorer summary (gracefully degrades when unavailable). */
import type { IpcMain } from 'electron'
import { CHANNELS } from '@shared/contract'
import type { CostReq } from '@shared/contract'
import { getCost } from '../../services/cost'

export function registerCostHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(CHANNELS.cost.get, (_e, req: CostReq) => getCost(req.ctx, req.range))
}
