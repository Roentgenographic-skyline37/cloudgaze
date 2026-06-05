/** ElastiCache clusters (Redis / Memcached nodes) — list + detail with CPU/memory/connection metrics. */
import { ElastiCacheClient, DescribeCacheClustersCommand } from '@aws-sdk/client-elasticache'
import type { CacheCluster } from '@aws-sdk/client-elasticache'
import { getClient } from '../aws'
import { field, join, paginate, section, stateTone } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const ec = getClient(ElastiCacheClient, ctx)
  const { items } = await paginate<CacheCluster>(async (token) => {
    const res = await ec.send(
      new DescribeCacheClustersCommand({ ShowCacheNodeInfo: false, Marker: token, MaxRecords: 100 })
    )
    return { items: res.CacheClusters ?? [], next: res.Marker }
  })

  const rows = items.map((c) => ({
    id: c.CacheClusterId ?? '',
    name: c.CacheClusterId ?? '',
    tones: { status: stateTone(c.CacheClusterStatus) },
    cells: {
      id: c.CacheClusterId ?? '',
      engine: join([c.Engine, c.EngineVersion], ' '),
      status: c.CacheClusterStatus ?? '',
      nodeType: c.CacheNodeType ?? '',
      nodes: c.NumCacheNodes ?? null,
      az: c.PreferredAvailabilityZone ?? ''
    }
  }))

  return {
    columns: [
      { key: 'id', label: 'Cluster', primary: true },
      { key: 'engine', label: 'Engine', kind: 'mono' },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'nodeType', label: 'Node Type', kind: 'mono' },
      { key: 'nodes', label: 'Nodes', kind: 'number', align: 'right' },
      { key: 'az', label: 'AZ', kind: 'mono' }
    ],
    rows
  }
}

function cacheMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'CacheClusterId', value: id }]
  return [
    { label: 'CPU %', namespace: 'AWS/ElastiCache', metricName: 'CPUUtilization', stat: 'Average', unit: 'Percent', dimensions: d },
    { label: 'Memory Usage %', namespace: 'AWS/ElastiCache', metricName: 'DatabaseMemoryUsagePercentage', stat: 'Average', unit: 'Percent', dimensions: d },
    { label: 'Connections', namespace: 'AWS/ElastiCache', metricName: 'CurrConnections', stat: 'Average', unit: 'Count', dimensions: d },
    { label: 'Network Bytes In', namespace: 'AWS/ElastiCache', metricName: 'NetworkBytesIn', stat: 'Sum', unit: 'Bytes', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const ec = getClient(ElastiCacheClient, ctx)
  const res = await ec.send(new DescribeCacheClustersCommand({ CacheClusterId: id, ShowCacheNodeInfo: true }))
  const c = res.CacheClusters?.[0]
  if (!c) throw new Error(`ElastiCache cluster ${id} not found in ${ctx.region}.`)

  return {
    id,
    name: id,
    service: 'elasticache',
    type: 'cache-cluster',
    region: ctx.region,
    status: c.CacheClusterStatus,
    statusTone: stateTone(c.CacheClusterStatus),
    tags: {},
    metrics: cacheMetrics(id),
    sections: [
      section('Cluster', [
        field('Identifier', id, 'mono'),
        field('Engine', join([c.Engine, c.EngineVersion], ' ')),
        field('Status', c.CacheClusterStatus, 'badge', { tone: stateTone(c.CacheClusterStatus) }),
        field('Node type', c.CacheNodeType, 'mono'),
        field('Nodes', c.NumCacheNodes ?? null, 'number')
      ]),
      section('Networking', [
        field('Endpoint', c.ConfigurationEndpoint?.Address, 'mono'),
        field('Port', c.ConfigurationEndpoint?.Port ?? null, 'number'),
        field('Subnet group', c.CacheSubnetGroupName),
        field('Availability zone', c.PreferredAvailabilityZone)
      ]),
      section('Config', [
        field('Parameter group', c.CacheParameterGroup?.CacheParameterGroupName),
        field('At-rest encryption', c.AtRestEncryptionEnabled ?? false, 'bool'),
        field('In-transit encryption', c.TransitEncryptionEnabled ?? false, 'bool'),
        field('Created', c.CacheClusterCreateTime ? new Date(c.CacheClusterCreateTime).toISOString() : null, 'datetime')
      ])
    ],
    raw: c
  }
}
