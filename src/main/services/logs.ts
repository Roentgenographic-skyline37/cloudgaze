/**
 * CloudWatch Logs search + tail.
 *
 * FilterLogEvents is the workhorse: it does both ad-hoc search (filter pattern
 * + time window) AND live tail (poll every N seconds with `startTime` advanced
 * to the latest event id we've seen). One handler covers both.
 *
 * Pattern syntax follows CloudWatch's own conventions, so users can search
 * structured JSON logs by field — `{ $.level = "ERROR" }`,
 * `{ $.statusCode >= 500 }` — exactly as in the AWS Console. No Logs Insights
 * needed for the common case, and no extra round-trips.
 */
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs'
import type { AwsCtx } from '@shared/types'
import type { LogEvent, LogsFilterReq, LogsFilterRes } from '@shared/contract'
import { getClient } from './aws'

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 10000

/** If the message looks like JSON, parse it; we surface the parsed fields so
 *  the UI can render structured columns and expand individual fields. */
function tryParseJson(msg: string): Record<string, unknown> | undefined {
  const trimmed = msg.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return undefined
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    // not JSON — that's fine, plain message
  }
  return undefined
}

export async function filterLogs(req: LogsFilterReq): Promise<LogsFilterRes> {
  const ctx: AwsCtx = req.ctx
  const client = getClient(CloudWatchLogsClient, ctx)
  const limit = Math.min(req.limit ?? DEFAULT_LIMIT, MAX_LIMIT)

  const events: LogEvent[] = []
  let nextToken: string | undefined
  let truncated = false
  // We page until we hit `limit` events or AWS runs out — whichever first.
  do {
    const out = await client.send(
      new FilterLogEventsCommand({
        logGroupName: req.group,
        startTime: new Date(req.fromIso).getTime(),
        endTime: new Date(req.toIso).getTime(),
        filterPattern: req.pattern?.trim() || undefined,
        // FilterLogEvents caps a single page at 10,000 events; we read in
        // smaller pages so the first page returns quickly.
        limit: Math.min(limit - events.length, 1000),
        nextToken
      })
    )
    for (const ev of out.events ?? []) {
      if (!ev.eventId || !ev.timestamp || ev.message == null) continue
      // Skip everything up to and including the sinceEventId for tail-mode
      // polling. (CloudWatch doesn't have a >eventId filter natively.)
      if (req.sinceEventId && ev.eventId <= req.sinceEventId) continue
      events.push({
        id: ev.eventId,
        ts: ev.timestamp,
        stream: ev.logStreamName ?? '',
        message: ev.message,
        fields: tryParseJson(ev.message)
      })
      if (events.length >= limit) {
        truncated = true
        break
      }
    }
    nextToken = out.nextToken
    if (events.length >= limit) break
  } while (nextToken)

  // CloudWatch returns newest-last; the UI wants newest-first.
  events.sort((a, b) => b.ts - a.ts)
  return { events, truncated }
}
