import type { CloudGazeApi } from '@shared/contract'

/** The preload-exposed bridge. All main-process access goes through this. */
export const api: CloudGazeApi = window.api
