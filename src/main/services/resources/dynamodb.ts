/** DynamoDB tables — list + detail with consumed-capacity / throttle metrics. */
import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
  ListTagsOfResourceCommand
} from '@aws-sdk/client-dynamodb'
import type { TableDescription } from '@aws-sdk/client-dynamodb'
import { getClient } from '../aws'
import { field, mapLimit, paginate, section, settle, stateTone, tagsToRecord } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const ddb = getClient(DynamoDBClient, ctx)

  const { items: names, truncated } = await paginate<string>(async (token) => {
    const res = await ddb.send(new ListTablesCommand({ ExclusiveStartTableName: token }))
    return { items: res.TableNames ?? [], next: res.LastEvaluatedTableName }
  })

  const described = await mapLimit(names, 12, (name) =>
    settle(ddb.send(new DescribeTableCommand({ TableName: name })), undefined)
  )

  const rows = names.map((name, i) => {
    const t = described[i]?.Table
    const status = t?.TableStatus
    return {
      id: name,
      name,
      tones: { status: stateTone(status) },
      cells: {
        name,
        status: status ?? '',
        items: t?.ItemCount ?? null,
        size: t?.TableSizeBytes ?? null,
        billing: t?.BillingModeSummary?.BillingMode ?? 'PROVISIONED',
        rcu: t?.ProvisionedThroughput?.ReadCapacityUnits ?? null,
        wcu: t?.ProvisionedThroughput?.WriteCapacityUnits ?? null
      }
    }
  })

  return {
    columns: [
      { key: 'name', label: 'Table', primary: true },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'items', label: 'Items', kind: 'number', align: 'right' },
      { key: 'size', label: 'Size', kind: 'bytes', align: 'right' },
      { key: 'billing', label: 'Billing', kind: 'mono' },
      { key: 'rcu', label: 'RCU', kind: 'number', align: 'right' },
      { key: 'wcu', label: 'WCU', kind: 'number', align: 'right' }
    ],
    rows,
    truncated
  }
}

function tableMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'TableName', value: id }]
  return [
    { label: 'Read Capacity (consumed)', namespace: 'AWS/DynamoDB', metricName: 'ConsumedReadCapacityUnits', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Write Capacity (consumed)', namespace: 'AWS/DynamoDB', metricName: 'ConsumedWriteCapacityUnits', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Throttled Requests', namespace: 'AWS/DynamoDB', metricName: 'ThrottledRequests', stat: 'Sum', unit: 'Count', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const ddb = getClient(DynamoDBClient, ctx)
  const res = await ddb.send(new DescribeTableCommand({ TableName: id }))
  const t = res.Table
  if (!t) throw new Error(`DynamoDB table ${id} not found in ${ctx.region}.`)

  const tagsRes = t.TableArn
    ? await settle(ddb.send(new ListTagsOfResourceCommand({ ResourceArn: t.TableArn })), undefined)
    : undefined

  const keys: TableDescription['KeySchema'] = t.KeySchema ?? []

  return {
    id,
    name: id,
    service: 'dynamodb',
    type: 'table',
    region: ctx.region,
    status: t.TableStatus,
    statusTone: stateTone(t.TableStatus),
    tags: tagsToRecord(tagsRes?.Tags),
    metrics: tableMetrics(id),
    sections: [
      section('Table', [
        field('Name', t.TableName, 'mono'),
        field('Status', t.TableStatus, 'badge', { tone: stateTone(t.TableStatus) }),
        field('Created', t.CreationDateTime ? new Date(t.CreationDateTime).toISOString() : null, 'datetime'),
        field('ARN', t.TableArn, 'mono'),
        field('Item count', t.ItemCount ?? null, 'number'),
        field('Size', t.TableSizeBytes ?? null, 'bytes')
      ]),
      section('Throughput', [
        field('Billing', t.BillingModeSummary?.BillingMode ?? 'PROVISIONED'),
        field('RCU', t.ProvisionedThroughput?.ReadCapacityUnits ?? null, 'number'),
        field('WCU', t.ProvisionedThroughput?.WriteCapacityUnits ?? null, 'number')
      ]),
      section(
        'Keys',
        keys.map((k) => field(k.KeyType ?? '', k.AttributeName ?? null))
      ),
      section('Indexes', [
        field('Global secondary', t.GlobalSecondaryIndexes?.length ?? null, 'number'),
        field('Local secondary', t.LocalSecondaryIndexes?.length ?? null, 'number'),
        field('Stream enabled', t.StreamSpecification?.StreamEnabled ?? false, 'bool')
      ])
    ],
    raw: t
  }
}
