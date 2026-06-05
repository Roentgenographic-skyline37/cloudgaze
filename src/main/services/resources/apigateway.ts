/** API Gateway v2 (HTTP/WebSocket APIs) — list + detail with stages and request metrics. */
import { ApiGatewayV2Client, GetApisCommand, GetApiCommand, GetStagesCommand } from '@aws-sdk/client-apigatewayv2'
import type { Api } from '@aws-sdk/client-apigatewayv2'
import { getClient } from '../aws'
import { field, join, paginate, section, settle } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const api = getClient(ApiGatewayV2Client, ctx)
  const { items: apis } = await paginate<Api>(async (token) => {
    const res = await api.send(new GetApisCommand({ NextToken: token, MaxResults: '100' }))
    return { items: res.Items ?? [], next: res.NextToken }
  })

  const rows = apis.map((a) => ({
    id: a.ApiId ?? '',
    name: a.Name ?? '',
    tags: a.Tags ?? {},
    cells: {
      name: a.Name ?? '',
      id: a.ApiId ?? '',
      protocol: a.ProtocolType ?? '',
      endpoint: a.ApiEndpoint ?? '',
      created: a.CreatedDate ? new Date(a.CreatedDate).toISOString() : null
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'id', label: 'API ID', kind: 'mono' },
      { key: 'protocol', label: 'Protocol' },
      { key: 'endpoint', label: 'Endpoint', kind: 'mono' },
      { key: 'created', label: 'Created', kind: 'ago', align: 'right' }
    ],
    rows
  }
}

function apiMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'ApiId', value: id }]
  return [
    { label: 'Count', namespace: 'AWS/ApiGateway', metricName: 'Count', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: '4xx', namespace: 'AWS/ApiGateway', metricName: '4xx', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: '5xx', namespace: 'AWS/ApiGateway', metricName: '5xx', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Latency', namespace: 'AWS/ApiGateway', metricName: 'Latency', stat: 'Average', unit: 'Milliseconds', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const client = getClient(ApiGatewayV2Client, ctx)
  const api = await client.send(new GetApiCommand({ ApiId: id }))

  const stagesRes = await settle(client.send(new GetStagesCommand({ ApiId: id })), undefined)
  const stages = stagesRes?.Items ?? []

  return {
    id,
    name: api.Name ?? id,
    service: 'apigateway',
    type: 'api',
    region: ctx.region,
    tags: api.Tags ?? {},
    metrics: apiMetrics(id),
    sections: [
      section('API', [
        field('Name', api.Name),
        field('ID', id, 'mono'),
        field('Protocol', api.ProtocolType),
        field('Endpoint', api.ApiEndpoint, 'mono'),
        field('Version', api.Version),
        field('Created', api.CreatedDate ? new Date(api.CreatedDate).toISOString() : null, 'datetime')
      ]),
      section('CORS', [field('CORS configured', api.CorsConfiguration != null, 'bool')]),
      section(
        'Stages',
        stages.map((s) => field(s.StageName ?? 'stage', join([`deployed:${s.AutoDeploy}`])))
      )
    ],
    raw: api
  }
}
