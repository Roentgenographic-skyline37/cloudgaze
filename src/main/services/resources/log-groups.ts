/** CloudWatch Logs log groups — list + detail with ingestion metrics. */
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand
} from '@aws-sdk/client-cloudwatch-logs'
import type { LogGroup } from '@aws-sdk/client-cloudwatch-logs'
import { getClient } from '../aws'
import { field, paginate, section, settle } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const logs = getClient(CloudWatchLogsClient, ctx)
  const { items, truncated } = await paginate<LogGroup>(async (token) => {
    const res = await logs.send(new DescribeLogGroupsCommand({ nextToken: token, limit: 50 }))
    return { items: res.logGroups ?? [], next: res.nextToken }
  })

  const rows = items.map((g) => ({
    id: g.logGroupName ?? '',
    name: g.logGroupName ?? '',
    cells: {
      name: g.logGroupName ?? '',
      retention: g.retentionInDays ?? null,
      stored: g.storedBytes ?? null,
      metricFilters: g.metricFilterCount ?? null,
      created: g.creationTime ? new Date(g.creationTime).toISOString() : null
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Log group', kind: 'mono', primary: true },
      { key: 'retention', label: 'Retention (days)', kind: 'number', align: 'right' },
      { key: 'stored', label: 'Stored', kind: 'bytes', align: 'right' },
      { key: 'metricFilters', label: 'Metric filters', kind: 'number', align: 'right' },
      { key: 'created', label: 'Created', kind: 'ago', align: 'right' }
    ],
    rows,
    truncated
  }
}

function logMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'LogGroupName', value: id }]
  return [
    { label: 'Incoming Bytes', namespace: 'AWS/Logs', metricName: 'IncomingBytes', stat: 'Sum', unit: 'Bytes', dimensions: d },
    { label: 'Incoming Log Events', namespace: 'AWS/Logs', metricName: 'IncomingLogEvents', stat: 'Sum', unit: 'Count', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const logs = getClient(CloudWatchLogsClient, ctx)
  const res = await logs.send(new DescribeLogGroupsCommand({ logGroupNamePrefix: id, limit: 50 }))
  const g = (res.logGroups ?? []).find((lg) => lg.logGroupName === id)
  if (!g) throw new Error(`Log group ${id} not found in ${ctx.region}.`)

  const streamsRes = await settle(
    logs.send(
      new DescribeLogStreamsCommand({
        logGroupName: id,
        orderBy: 'LastEventTime',
        descending: true,
        limit: 5
      })
    ),
    undefined
  )

  return {
    id,
    name: g.logGroupName ?? id,
    service: 'log-groups',
    type: 'log-group',
    region: ctx.region,
    tags: {},
    metrics: logMetrics(id),
    sections: [
      section('Log group', [
        field('Name', g.logGroupName, 'mono'),
        field('ARN', g.arn ?? g.logGroupArn, 'arn'),
        field('Created', g.creationTime ? new Date(g.creationTime).toISOString() : null, 'datetime'),
        field('Retention (days)', g.retentionInDays ?? null, 'number'),
        field('Stored', g.storedBytes ?? null, 'bytes'),
        field('Metric filters', g.metricFilterCount ?? null, 'number'),
        field('KMS key', g.kmsKeyId, 'mono')
      ]),
      section(
        'Recent streams',
        (streamsRes?.logStreams ?? []).map((st) =>
          field(
            st.logStreamName ?? '',
            st.lastEventTimestamp ? new Date(st.lastEventTimestamp).toISOString() : '—'
          )
        )
      )
    ],
    raw: g
  }
}
