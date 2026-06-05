/** Lambda functions — list + detail with invocation/error/duration metrics. */
import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionConfigurationCommand,
  ListTagsCommand
} from '@aws-sdk/client-lambda'
import type { FunctionConfiguration } from '@aws-sdk/client-lambda'
import { getClient } from '../aws'
import { field, join, paginate, section, settle } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const lambda = getClient(LambdaClient, ctx)
  const { items, truncated } = await paginate<FunctionConfiguration>(async (token) => {
    const res = await lambda.send(new ListFunctionsCommand({ Marker: token, MaxItems: 50 }))
    return { items: res.Functions ?? [], next: res.NextMarker }
  })

  const rows = items.map((f) => ({
    id: f.FunctionName ?? '',
    name: f.FunctionName ?? '',
    cells: {
      name: f.FunctionName ?? '',
      runtime: f.Runtime ?? f.PackageType ?? '',
      memory: f.MemorySize ?? null,
      timeout: f.Timeout ?? null,
      handler: f.Handler ?? '',
      modified: f.LastModified ? new Date(f.LastModified).toISOString() : null
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Function', primary: true },
      { key: 'runtime', label: 'Runtime', kind: 'mono' },
      { key: 'memory', label: 'Memory (MB)', kind: 'number', align: 'right' },
      { key: 'timeout', label: 'Timeout (s)', kind: 'number', align: 'right' },
      { key: 'handler', label: 'Handler', kind: 'mono' },
      { key: 'modified', label: 'Modified', kind: 'ago', align: 'right' }
    ],
    rows,
    truncated
  }
}

function fnMetrics(name: string): MetricSpecDTO[] {
  const d = [{ name: 'FunctionName', value: name }]
  return [
    { label: 'Invocations', namespace: 'AWS/Lambda', metricName: 'Invocations', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Errors', namespace: 'AWS/Lambda', metricName: 'Errors', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Throttles', namespace: 'AWS/Lambda', metricName: 'Throttles', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Duration (avg)', namespace: 'AWS/Lambda', metricName: 'Duration', stat: 'Average', unit: 'Milliseconds', dimensions: d },
    { label: 'Duration (p99)', namespace: 'AWS/Lambda', metricName: 'Duration', stat: 'p99', unit: 'Milliseconds', dimensions: d },
    { label: 'Concurrent', namespace: 'AWS/Lambda', metricName: 'ConcurrentExecutions', stat: 'Maximum', unit: 'Count', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const lambda = getClient(LambdaClient, ctx)
  const cfg = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: id }))
  const tagsRes = cfg.FunctionArn
    ? await settle(lambda.send(new ListTagsCommand({ Resource: cfg.FunctionArn })), undefined)
    : undefined

  const envKeys = Object.keys(cfg.Environment?.Variables ?? {})

  return {
    id,
    name: cfg.FunctionName ?? id,
    service: 'lambda',
    type: 'function',
    region: ctx.region,
    status: cfg.State,
    statusTone: cfg.State === 'Active' ? 'ok' : cfg.State === 'Failed' ? 'error' : 'warn',
    tags: tagsRes?.Tags ?? {},
    metrics: fnMetrics(id),
    related: cfg.VpcConfig?.VpcId ? [{ service: 'vpc', label: 'VPC', id: cfg.VpcConfig.VpcId }] : [],
    sections: [
      section('Runtime', [
        field('Function name', cfg.FunctionName, 'mono'),
        field('Runtime', cfg.Runtime ?? cfg.PackageType),
        field('Handler', cfg.Handler, 'mono'),
        field('Architectures', join(cfg.Architectures ?? [], ', ')),
        field('Memory', cfg.MemorySize ? `${cfg.MemorySize} MB` : null),
        field('Ephemeral storage', cfg.EphemeralStorage?.Size ? `${cfg.EphemeralStorage.Size} MB` : null),
        field('Timeout', cfg.Timeout ? `${cfg.Timeout}s` : null),
        field('Last modified', cfg.LastModified ? new Date(cfg.LastModified).toISOString() : null, 'datetime')
      ]),
      section('Execution', [
        field('Role', cfg.Role, 'arn'),
        field('State', cfg.State, 'badge', { tone: cfg.State === 'Active' ? 'ok' : 'warn' }),
        field('Last update', cfg.LastUpdateStatus),
        field('Code size', cfg.CodeSize ?? null, 'bytes'),
        field('Layers', String((cfg.Layers ?? []).length)),
        field('Env variables', envKeys.length ? envKeys.join(', ') : 'none')
      ]),
      ...(cfg.VpcConfig?.VpcId
        ? [
            section('VPC', [
              field('VPC', cfg.VpcConfig.VpcId, 'mono'),
              field('Subnets', join(cfg.VpcConfig.SubnetIds ?? [], ', ')),
              field('Security groups', join(cfg.VpcConfig.SecurityGroupIds ?? [], ', '))
            ])
          ]
        : [])
    ],
    raw: cfg
  }
}
