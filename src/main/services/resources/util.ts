/**
 * Shared helpers for resource listers/detailers. These keep each service module
 * tiny and consistent: tag handling, status→tone mapping, detail-field builders
 * and a generic token paginator.
 */
import type { AwsCtx, CellValue, DetailField, DetailSection, ResourceDetailResult, ResourceListResult, Tone } from '@shared/types'

/** Every service module implements this. */
export interface ResourceModule {
  list(ctx: AwsCtx): Promise<ResourceListResult>
  detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult>
}

interface AwsTag {
  Key?: string
  Value?: string
}

/** Convert EC2-style [{Key,Value}] tags into a plain record. */
export function tagsToRecord(tags?: AwsTag[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const t of tags ?? []) {
    if (t.Key) out[t.Key] = t.Value ?? ''
  }
  return out
}

/** The conventional display name: the `Name` tag, else undefined. */
export function nameFromTags(tags?: AwsTag[]): string | undefined {
  return tags?.find((t) => t.Key === 'Name')?.Value || undefined
}

// Steady "off" states (stopped / disabled / inactive) deliberately fall through
// to neutral — they're intentional, not problems.
const OK = /^(running|available|active|in-use|enabled|issued|healthy|ok|ready|complete|completed|insync|in_sync|succeeded|provisioned|created|attached|online|pass)/i
const WARN = /^(pending|creating|modifying|rebooting|provisioning|updating|deleting|stopping|starting|backing-up|maintenance|in_progress|inprogress|impaired|warning|insufficient_data|expiring|configuring)/i
const BAD = /^(terminated|terminating|failed|error|deleted|unavailable|unhealthy|rollback|delete_failed|create_failed|update_failed|revoked|alarm|incompatible|degraded|expired|fault)/i

/** Map a raw AWS status/state string to a semantic UI tone. */
export function stateTone(state?: string | null): Tone {
  if (!state) return 'neutral'
  const s = String(state).toLowerCase()
  if (BAD.test(s)) return 'error'
  if (WARN.test(s)) return 'warn'
  if (OK.test(s)) return 'ok'
  return 'neutral'
}

/** Last path segment of an ARN (or the input unchanged). */
export function shortArn(arn?: string): string {
  if (!arn) return ''
  const slash = arn.lastIndexOf('/')
  if (slash >= 0) return arn.slice(slash + 1)
  const colon = arn.lastIndexOf(':')
  return colon >= 0 ? arn.slice(colon + 1) : arn
}

/** Build a detail field, coercing undefined → null. */
export function field(
  label: string,
  value: CellValue | undefined,
  kind?: DetailField['kind'],
  opts?: { tone?: Tone; mono?: boolean }
): DetailField {
  return { label, value: value ?? null, kind, tone: opts?.tone, mono: opts?.mono }
}

/** A detail section, dropping empty fields when `compact`. */
export function section(title: string, fields: (DetailField | null | undefined)[]): DetailSection {
  return { title, fields: fields.filter((f): f is DetailField => Boolean(f)) }
}

/**
 * Generic token paginator. `fetchPage` returns this page's items + the next
 * token (any of NextToken/Marker/NextMarker/ContinuationToken — the caller
 * extracts it). Stops at `cap` items to bound cost on huge accounts.
 */
export async function paginate<T>(
  fetchPage: (token?: string) => Promise<{ items: T[]; next?: string }>,
  cap = 2000
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = []
  let token: string | undefined
  let guard = 0
  do {
    const { items: page, next } = await fetchPage(token)
    items.push(...page)
    token = next
    guard += 1
    if (items.length >= cap) return { items: items.slice(0, cap), truncated: true }
  } while (token && guard < 1000)
  return { items, truncated: false }
}

/** Truthy-join several parts with a separator, skipping blanks. */
export function join(parts: (string | number | null | undefined)[], sep = ' · '): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== '').join(sep)
}

/** Map over items with a bounded concurrency (default 12). */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

/** Swallow a per-item AWS error, returning a fallback (for best-effort enrich). */
export async function settle<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}
