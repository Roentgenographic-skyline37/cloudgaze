/** Resource handlers — generic list + detail dispatched through the registry. */
import type { IpcMain } from 'electron'
import { CHANNELS } from '@shared/contract'
import type { ListResourcesReq, ResourceDetailReq } from '@shared/contract'
import { listResource, resourceDetail } from '../../services/resources'

export function registerResourceHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(CHANNELS.resource.list, (_e, req: ListResourcesReq) => listResource(req.ctx, req.service))
  ipcMain.handle(CHANNELS.resource.detail, (_e, req: ResourceDetailReq) =>
    resourceDetail(req.ctx, req.service, req.id)
  )
}
