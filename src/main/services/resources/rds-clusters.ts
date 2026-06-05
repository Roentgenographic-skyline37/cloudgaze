/** RDS DB clusters (Aurora & Multi-AZ clusters) — list + detail with cluster-level CloudWatch charts. */
import { RDSClient, DescribeDBClustersCommand } from '@aws-sdk/client-rds'
import type { DBCluster } from '@aws-sdk/client-rds'
import { getClient } from '../aws'
import { field, join, paginate, section, stateTone, tagsToRecord } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

async function describe(ctx: AwsCtx, id?: string): Promise<DBCluster[]> {
  const rds = getClient(RDSClient, ctx)
  const { items } = await paginate<DBCluster>(async (token) => {
    const res = await rds.send(
      new DescribeDBClustersCommand({ DBClusterIdentifier: id, Marker: token, MaxRecords: id ? undefined : 100 })
    )
    return { items: res.DBClusters ?? [], next: res.Marker }
  })
  return items
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const clusters = await describe(ctx)
  const rows = clusters.map((c) => ({
    id: c.DBClusterIdentifier ?? '',
    name: c.DBClusterIdentifier ?? '',
    tones: { status: stateTone(c.Status) },
    tags: tagsToRecord(c.TagList),
    cells: {
      id: c.DBClusterIdentifier ?? '',
      engine: join([c.Engine, c.EngineVersion], ' '),
      status: c.Status ?? '',
      members: c.DBClusterMembers?.length ?? null,
      endpoint: c.Endpoint ?? '',
      multiAz: c.MultiAZ ?? false
    }
  }))
  return {
    columns: [
      { key: 'id', label: 'Identifier', primary: true },
      { key: 'engine', label: 'Engine', kind: 'mono' },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'members', label: 'Members', kind: 'number', align: 'right' },
      { key: 'endpoint', label: 'Endpoint', kind: 'mono' },
      { key: 'multiAz', label: 'Multi-AZ', kind: 'bool' }
    ],
    rows
  }
}

function clusterMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'DBClusterIdentifier', value: id }]
  return [
    { label: 'CPU %', namespace: 'AWS/RDS', metricName: 'CPUUtilization', stat: 'Average', unit: 'Percent', dimensions: d },
    { label: 'Connections', namespace: 'AWS/RDS', metricName: 'DatabaseConnections', stat: 'Average', unit: 'Count', dimensions: d },
    { label: 'Freeable Memory', namespace: 'AWS/RDS', metricName: 'FreeableMemory', stat: 'Average', unit: 'Bytes', dimensions: d },
    { label: 'Volume Used', namespace: 'AWS/RDS', metricName: 'VolumeBytesUsed', stat: 'Average', unit: 'Bytes', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const [c] = await describe(ctx, id)
  if (!c) throw new Error(`DB cluster ${id} not found in ${ctx.region}.`)

  const members = c.DBClusterMembers ?? []

  return {
    id,
    name: id,
    service: 'rds-clusters',
    type: 'db-cluster',
    region: ctx.region,
    status: c.Status,
    statusTone: stateTone(c.Status),
    tags: tagsToRecord(c.TagList),
    metrics: clusterMetrics(id),
    related: members
      .slice(0, 6)
      .map((m) => ({ service: 'rds', label: 'Instance', id: m.DBInstanceIdentifier ?? '' }))
      .filter((r) => r.id),
    sections: [
      section('Engine', [
        field('Identifier', id, 'mono'),
        field('Engine', join([c.Engine, c.EngineVersion], ' ')),
        field('Version', c.EngineVersion, 'mono'),
        field('Status', c.Status, 'badge', { tone: stateTone(c.Status) }),
        field('Mode', c.EngineMode)
      ]),
      section('Endpoints', [
        field('Writer', c.Endpoint, 'mono'),
        field('Reader', c.ReaderEndpoint, 'mono'),
        field('Port', c.Port ?? null, 'number')
      ]),
      section(
        'Members',
        members.map((m) =>
          field(m.DBInstanceIdentifier ?? '', m.IsClusterWriter ? 'writer' : 'reader')
        )
      ),
      section('Storage / Backup', [
        field('Allocated', c.AllocatedStorage ? c.AllocatedStorage * 1024 ** 3 : null, 'bytes'),
        field('Encrypted', c.StorageEncrypted ?? false, 'bool'),
        field('Backup retention (days)', c.BackupRetentionPeriod ?? null, 'number'),
        field('Created', c.ClusterCreateTime ? new Date(c.ClusterCreateTime).toISOString() : null, 'datetime')
      ])
    ],
    raw: c
  }
}
