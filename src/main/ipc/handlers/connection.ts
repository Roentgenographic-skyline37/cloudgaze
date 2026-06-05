/** AWS connection handlers — profile/region discovery + the credential gate. */
import type { IpcMain } from 'electron'
import { CHANNELS } from '@shared/contract'
import type { CheckReq, SaveCredsReq } from '@shared/contract'
import { AWS_REGIONS } from '@shared/config'
import { listProfiles, checkCredentials, saveCredentials } from '../../services/credentials'

export function registerConnectionHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(CHANNELS.aws.listProfiles, () => listProfiles())
  ipcMain.handle(CHANNELS.aws.listRegions, () => AWS_REGIONS)
  ipcMain.handle(CHANNELS.aws.check, (_e, req: CheckReq) => checkCredentials(req))
  ipcMain.handle(CHANNELS.aws.saveCreds, (_e, req: SaveCredsReq) => saveCredentials(req))
}
