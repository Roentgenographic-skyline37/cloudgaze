/** CloudWatch Logs handler — search + tail. */
import type { IpcMain } from 'electron'
import { CHANNELS } from '@shared/contract'
import type { LogsFilterReq, LogsFilterRes } from '@shared/contract'
import { filterLogs } from '../../services/logs'

export function registerLogsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(CHANNELS.logs.filter, (_e, req: LogsFilterReq): Promise<LogsFilterRes> => filterLogs(req))
}
