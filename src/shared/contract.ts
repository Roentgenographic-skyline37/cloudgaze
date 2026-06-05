/**
 * THE typed IPC contract — single source of truth for main, preload, and
 * renderer. Lives in @shared so the renderer can type window.api without
 * importing across the main/renderer tsconfig project boundary.
 *
 * All channels are request/response (ipcRenderer.invoke / ipcMain.handle).
 * CloudGaze is stateless on the main side: every request carries the AwsCtx
 * (profile + region) it targets, and clients are memoized per pair.
 */
import type {
  AwsCtx,
  AwsIdentity,
  AwsProfile,
  AwsRegion,
  ConnectionStatus,
  CostSummary,
  InventoryCount,
  MetricSeries,
  MetricSpecDTO,
  ResourceDetailResult,
  ResourceListResult,
  TimeRange
} from './types'

// ---------------------------------------------------------------------------
// Channel names
// ---------------------------------------------------------------------------

export const CHANNELS = {
  aws: {
    /** List AWS profiles discovered in ~/.aws (+ an env-credentials entry). */
    listProfiles: 'aws:listProfiles',
    /** The static list of AWS regions (id + human label). */
    listRegions: 'aws:listRegions',
    /** Validate credentials for a (profile, region) — STS GetCallerIdentity. */
    check: 'aws:check',
    /** Persist credentials to a ~/.aws profile, then validate. */
    saveCreds: 'aws:saveCreds'
  },
  resource: {
    /** List resources for one service in the given context. */
    list: 'resource:list',
    /** Full detail for one resource. */
    detail: 'resource:detail'
  },
  metrics: {
    /** Fetch CloudWatch series for an arbitrary set of metric specs. */
    get: 'metrics:get',
    /** Fetch a service's headline aggregate metrics (Deployed dashboard). */
    service: 'metrics:service'
  },
  inventory: {
    /** Count resources across (a subset of) services for the Overview. */
    get: 'inventory:get'
  },
  cost: {
    /** Cost Explorer summary (graceful when not accessible). */
    get: 'cost:get'
  }
} as const

// ---------------------------------------------------------------------------
// AWS connection + credential gate
// ---------------------------------------------------------------------------

export type ListProfilesRes = AwsProfile[]
export type ListRegionsRes = AwsRegion[]

export type CheckReq = AwsCtx
export type CheckRes = ConnectionStatus

export interface SaveCredsReq {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  region: string
  /** Profile to write to (defaults to "default"). */
  profile?: string
}
export type SaveCredsRes = ConnectionStatus

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export interface ListResourcesReq {
  ctx: AwsCtx
  /** Service id (matches ServiceMeta.id). */
  service: string
}
export type ListResourcesRes = ResourceListResult

export interface ResourceDetailReq {
  ctx: AwsCtx
  service: string
  /** The resource id returned by the lister. */
  id: string
}
export type ResourceDetailRes = ResourceDetailResult

// ---------------------------------------------------------------------------
// Metrics (CloudWatch)
// ---------------------------------------------------------------------------

export interface MetricsReq {
  ctx: AwsCtx
  specs: MetricSpecDTO[]
  range: TimeRange
}
export interface MetricsRes {
  series: MetricSeries[]
}

export interface ServiceMetricsReq {
  ctx: AwsCtx
  service: string
  range: TimeRange
}

// ---------------------------------------------------------------------------
// Inventory (Overview)
// ---------------------------------------------------------------------------

export interface InventoryReq {
  ctx: AwsCtx
  /** Restrict to these service ids; omit for all. */
  services?: string[]
}
export interface InventoryRes {
  counts: InventoryCount[]
  identity?: AwsIdentity
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

export interface CostReq {
  ctx: AwsCtx
  range: TimeRange
}
export type CostRes = CostSummary

// ---------------------------------------------------------------------------
// The preload-exposed API surface (window.api)
// ---------------------------------------------------------------------------

export interface CloudGazeApi {
  listProfiles(): Promise<ListProfilesRes>
  listRegions(): Promise<ListRegionsRes>
  check(req: CheckReq): Promise<CheckRes>
  saveCreds(req: SaveCredsReq): Promise<SaveCredsRes>
  listResources(req: ListResourcesReq): Promise<ListResourcesRes>
  resourceDetail(req: ResourceDetailReq): Promise<ResourceDetailRes>
  getMetrics(req: MetricsReq): Promise<MetricsRes>
  getServiceMetrics(req: ServiceMetricsReq): Promise<MetricsRes>
  getInventory(req: InventoryReq): Promise<InventoryRes>
  getCost(req: CostReq): Promise<CostRes>
}
