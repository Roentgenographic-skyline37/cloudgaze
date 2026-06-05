/**
 * registerHandlers — wires every handler group onto ipcMain. All channels are
 * request/response; CloudGaze has no push channels (no streaming).
 */
import type { IpcMain } from 'electron'
import { registerConnectionHandlers } from './connection'
import { registerResourceHandlers } from './resources'
import { registerMetricsHandlers } from './metrics'
import { registerInventoryHandlers } from './inventory'
import { registerCostHandlers } from './cost'

export function registerHandlers(ipcMain: IpcMain): void {
  registerConnectionHandlers(ipcMain)
  registerResourceHandlers(ipcMain)
  registerMetricsHandlers(ipcMain)
  registerInventoryHandlers(ipcMain)
  registerCostHandlers(ipcMain)
}
