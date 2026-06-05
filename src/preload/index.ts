/**
 * Preload bridge — exposes a typed, minimal `window.api` to the renderer over
 * contextBridge. The renderer has no Node access; everything goes through these
 * request/response channels.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '@shared/contract'
import type { CloudGazeApi } from '@shared/contract'

const api: CloudGazeApi = {
  listProfiles: () => ipcRenderer.invoke(CHANNELS.aws.listProfiles),
  listRegions: () => ipcRenderer.invoke(CHANNELS.aws.listRegions),
  check: (req) => ipcRenderer.invoke(CHANNELS.aws.check, req),
  saveCreds: (req) => ipcRenderer.invoke(CHANNELS.aws.saveCreds, req),

  listResources: (req) => ipcRenderer.invoke(CHANNELS.resource.list, req),
  resourceDetail: (req) => ipcRenderer.invoke(CHANNELS.resource.detail, req),

  getMetrics: (req) => ipcRenderer.invoke(CHANNELS.metrics.get, req),
  getServiceMetrics: (req) => ipcRenderer.invoke(CHANNELS.metrics.service, req),
  getInventory: (req) => ipcRenderer.invoke(CHANNELS.inventory.get, req),
  getCost: (req) => ipcRenderer.invoke(CHANNELS.cost.get, req)
}

contextBridge.exposeInMainWorld('api', api)
