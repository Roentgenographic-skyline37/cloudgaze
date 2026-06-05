import type { CloudGazeApi } from '@shared/contract'

declare global {
  interface Window {
    api: CloudGazeApi
  }
}

export {}
