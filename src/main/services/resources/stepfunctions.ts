/** Step Functions state machines — list + detail with execution metrics. */
import {
  SFNClient,
  ListStateMachinesCommand,
  DescribeStateMachineCommand,
  ListTagsForResourceCommand
} from '@aws-sdk/client-sfn'
import type { StateMachineListItem } from '@aws-sdk/client-sfn'
import { getClient } from '../aws'
import { field, paginate, section, settle, tagsToRecord } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const sfn = getClient(SFNClient, ctx)
  const { items, truncated } = await paginate<StateMachineListItem>(async (token) => {
    const res = await sfn.send(new ListStateMachinesCommand({ nextToken: token, maxResults: 100 }))
    return { items: res.stateMachines ?? [], next: res.nextToken }
  })

  const rows = items.map((m) => ({
    id: m.stateMachineArn ?? '',
    name: m.name ?? '',
    cells: {
      name: m.name ?? '',
      type: m.type ?? '',
      created: m.creationDate ? new Date(m.creationDate).toISOString() : null,
      arn: m.stateMachineArn ?? ''
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'State machine', primary: true },
      { key: 'type', label: 'Type' },
      { key: 'created', label: 'Created', kind: 'ago', align: 'right' },
      { key: 'arn', label: 'ARN', kind: 'mono' }
    ],
    rows,
    truncated
  }
}

function sfnMetrics(arn: string): MetricSpecDTO[] {
  const d = [{ name: 'StateMachineArn', value: arn }]
  return [
    { label: 'Executions Started', namespace: 'AWS/States', metricName: 'ExecutionsStarted', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Executions Succeeded', namespace: 'AWS/States', metricName: 'ExecutionsSucceeded', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Executions Failed', namespace: 'AWS/States', metricName: 'ExecutionsFailed', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Execution Time', namespace: 'AWS/States', metricName: 'ExecutionTime', stat: 'Average', unit: 'Milliseconds', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const sfn = getClient(SFNClient, ctx)
  const s = await sfn.send(new DescribeStateMachineCommand({ stateMachineArn: id }))

  const tagsRes = await settle(sfn.send(new ListTagsForResourceCommand({ resourceArn: id })), undefined)
  const tags = tagsToRecord((tagsRes?.tags ?? []).map((t) => ({ Key: t.key, Value: t.value })))

  return {
    id,
    name: s.name ?? id,
    service: 'stepfunctions',
    type: 'state-machine',
    region: ctx.region,
    status: s.status,
    tags,
    metrics: sfnMetrics(id),
    sections: [
      section('State machine', [
        field('Name', s.name),
        field('ARN', s.stateMachineArn, 'mono'),
        field('Type', s.type),
        field('Status', s.status),
        field('Role', s.roleArn, 'arn'),
        field('Created', s.creationDate ? new Date(s.creationDate).toISOString() : null, 'datetime')
      ]),
      section('Logging', [
        field('Level', s.loggingConfiguration?.level),
        field('Include execution data', s.loggingConfiguration?.includeExecutionData ?? null, 'bool')
      ]),
      section('Tracing', [field('Enabled', s.tracingConfiguration?.enabled ?? null, 'bool')]),
      section('Definition', [field('Length', s.definition?.length ?? null, 'number')])
    ],
    raw: s
  }
}
