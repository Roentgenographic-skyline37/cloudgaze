/** Inventory handler — per-service counts + identity for the Overview page. */
import type { IpcMain } from 'electron'
import { CHANNELS } from '@shared/contract'
import type { InventoryReq, InventoryRes } from '@shared/contract'
import { getInventory } from '../../services/inventory'
import { checkCredentials } from '../../services/credentials'

export function registerInventoryHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(CHANNELS.inventory.get, async (_e, req: InventoryReq): Promise<InventoryRes> => {
    const [counts, status] = await Promise.all([
      getInventory(req.ctx, req.services),
      checkCredentials(req.ctx)
    ])
    return { counts, identity: status.identity }
  })
}
