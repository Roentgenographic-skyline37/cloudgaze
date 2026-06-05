/** Inventory handler — per-service counts + identity for the Overview page. */
import type { IpcMain } from 'electron'
import { CHANNELS } from '@shared/contract'
import type { InventoryReq, InventoryRes, InventoryStreamRes } from '@shared/contract'
import { getInventory, streamInventory } from '../../services/inventory'
import { checkCredentials } from '../../services/credentials'

export function registerInventoryHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(CHANNELS.inventory.get, async (_e, req: InventoryReq): Promise<InventoryRes> => {
    const [counts, status] = await Promise.all([
      getInventory(req.ctx, req.services),
      checkCredentials(req.ctx)
    ])
    return { counts, identity: status.identity }
  })

  ipcMain.handle(
    CHANNELS.inventory.stream,
    async (e, req: InventoryReq & { streamId: string }): Promise<InventoryStreamRes> => {
      // Kick the identity probe in parallel so it's ready by the time the last
      // service finishes.
      const idP = checkCredentials(req.ctx)
      await streamInventory(req.ctx, req.services, (count) => {
        if (e.sender.isDestroyed()) return
        e.sender.send(CHANNELS.inventory.progress, { streamId: req.streamId, count })
      })
      const status = await idP
      return { identity: status.identity }
    }
  )
}
