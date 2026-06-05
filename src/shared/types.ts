/**
 * Domain + DTO types shared across main, preload, and renderer.
 *
 * CloudGaze is generic: instead of one bespoke type per AWS resource, listers
 * and detailers in the main process return a small set of *display-oriented*
 * shapes (ResourceListResult / ResourceDetailResult). The renderer renders any
 * service from that data with zero per-service code — which is what makes
 * "add a service = one file" possible.
 *
 * Everything here is JSON-safe (strings / numbers / booleans / plain objects).
 */

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export type TimePreset = '15m' | '1h' | '6h' | '24h' | '7d' | '30d' | 'custom'

export interface TimeRange {
  fromIso: string
  toIso: string
  preset: TimePreset
}

// ---------------------------------------------------------------------------
// UI vocabulary — shared so listers can drive coloring + formatting from main
// ---------------------------------------------------------------------------

/** Semantic color tone, mapped to the design tokens in the renderer. */
export type Tone = 'neutral' | 'ok' | 'warn' | 'error' | 'info' | 'accent'

/**
 * How a value should be formatted/rendered in a table cell or detail field.
 * The renderer owns the actual formatting (see lib/format.ts) so main stays
 * free of presentation code.
 */
export type CellKind =
  | 'text'
  | 'mono'
  | 'number'
  | 'bytes'
  | 'datetime'
  | 'ago'
  | 'badge'
  | 'bool'
  | 'pct'
  | 'usd'
  | 'duration'
  | 'arn'

export type CellValue = string | number | boolean | null

// ---------------------------------------------------------------------------
// AWS connection context — every request carries the (profile, region) it
// targets, so the main process stays stateless and clients memoize per pair.
// ---------------------------------------------------------------------------

export interface AwsCtx {
  profile: string
  region: string
}

export interface AwsProfile {
  name: string
  /** Region configured for the profile in ~/.aws/config, when present. */
  region?: string
  /** Where the profile was discovered. */
  source: 'credentials' | 'config' | 'env' | 'sso'
  /** True when the profile carries a session token — i.e. temporary credentials. */
  temporary?: boolean
}

export interface AwsRegion {
  id: string
  label: string
}

/** The principal currently authenticated (STS GetCallerIdentity). */
export interface AwsIdentity {
  accountId?: string
  arn?: string
  userId?: string
  region: string
  profile: string
}

export interface ConnectionStatus {
  ok: boolean
  identity?: AwsIdentity
  profile: string
  region: string
  error?: string
}

// ---------------------------------------------------------------------------
// Metrics (CloudWatch)
// ---------------------------------------------------------------------------

export interface MetricPoint {
  /** ISO timestamp. */
  t: string
  v: number
}

export interface MetricSeries {
  label: string
  /** e.g. "Percent", "Bytes", "Count", "Seconds", "Count/Second". */
  unit: string
  points: MetricPoint[]
}

/**
 * A CloudWatch metric a detailer asks the UI to chart. The renderer turns this
 * straight into a getMetrics() request, so any service can surface metrics
 * without bespoke wiring.
 */
export interface MetricSpecDTO {
  label: string
  /** Display unit hint (drives axis formatting). */
  unit?: string
  // --- a single metric (per-resource detail) -------------------------------
  namespace?: string
  metricName?: string
  /** 'Average' | 'Sum' | 'Maximum' | 'Minimum' | 'p95' | … */
  stat?: string
  dimensions?: { name: string; value: string }[]
  // --- OR a metric-math expression (service-level aggregates) ---------------
  /**
   * A CloudWatch metric-math expression, e.g. an aggregated SEARCH across every
   * resource in a namespace. Use the literal token __PERIOD__ where a period
   * (in seconds) is required, e.g.
   * `AVG(SEARCH('{AWS/EC2,InstanceId} MetricName="CPUUtilization"', 'Average', __PERIOD__))`.
   */
  expression?: string
}

// ---------------------------------------------------------------------------
// Generic resource model — the contract every service lister/detailer fills
// ---------------------------------------------------------------------------

export interface ResourceColumn {
  key: string
  label: string
  kind?: CellKind
  align?: 'left' | 'right'
  /** The identifier/name column (rendered emphasized, opens detail). */
  primary?: boolean
}

export interface ResourceRow {
  /** Stable id used to fetch detail and as the React key. */
  id: string
  /** Display name; falls back to id when absent. */
  name?: string
  cells: Record<string, CellValue>
  /** Optional per-column tone for status coloring (keyed by column key). */
  tones?: Record<string, Tone>
  tags?: Record<string, string>
}

export interface ResourceListResult {
  columns: ResourceColumn[]
  rows: ResourceRow[]
  /** A safety cap was hit; some rows are omitted. */
  truncated?: boolean
  /** Optional human note (e.g. "global service — region selector ignored"). */
  note?: string
}

export interface DetailField {
  label: string
  value: CellValue
  kind?: CellKind
  tone?: Tone
  mono?: boolean
}

export interface DetailSection {
  title: string
  fields: DetailField[]
}

/** A pointer to a related resource (rendered as a chip in the detail panel). */
export interface RelatedRef {
  service: string
  label: string
  id: string
}

export interface ResourceDetailResult {
  id: string
  name?: string
  service: string
  type: string
  region: string
  status?: string
  statusTone?: Tone
  sections: DetailSection[]
  tags: Record<string, string>
  /** CloudWatch series to chart for this resource, when it emits metrics. */
  metrics?: MetricSpecDTO[]
  related?: RelatedRef[]
  /** The full raw Describe/Get response, shown in the JSON viewer. */
  raw: unknown
}

// ---------------------------------------------------------------------------
// Inventory (Overview) — counts per service across the selected region
// ---------------------------------------------------------------------------

export interface InventoryBreakdown {
  label: string
  count: number
  tone: Tone
}

export interface InventoryCount {
  /** Service id (matches ServiceMeta.id). */
  service: string
  count: number
  /** Per-service error (e.g. AccessDenied); count stays 0. */
  error?: string
  /** Status breakdown derived from the rows' badge column (e.g. running/stopped). */
  breakdown?: InventoryBreakdown[]
  /** A few sample resource names for context on the Overview card. */
  samples?: string[]
}

// ---------------------------------------------------------------------------
// Cost (Cost Explorer — optional, gracefully degrades)
// ---------------------------------------------------------------------------

export interface CostDatum {
  label: string
  amountUsd: number
}

export interface CostTrendPoint {
  t: string
  amountUsd: number
}

export interface CostSummary {
  /** False when Cost Explorer isn't enabled / accessible for this account. */
  available: boolean
  error?: string
  totalUsd: number
  granularity: 'DAILY' | 'MONTHLY'
  trend: CostTrendPoint[]
  byService: CostDatum[]
  currency: string
  start: string
  end: string
}
