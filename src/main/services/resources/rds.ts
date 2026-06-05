/** RDS DB instances — list + detail with live CloudWatch charts. */
import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds'
import type { DBInstance } from '@aws-sdk/client-rds'
import { getClient } from '../aws'
import { field, join, paginate, section, stateTone, tagsToRecord } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

async function describe(ctx: AwsCtx, id?: string): Promise<DBInstance[]> {
  const rds = getClient(RDSClient, ctx)
  const { items } = await paginate<DBInstance>(async (token) => {
    const res = await rds.send(
      new DescribeDBInstancesCommand({ DBInstanceIdentifier: id, Marker: token, MaxRecords: id ? undefined : 100 })
    )
    return { items: res.DBInstances ?? [], next: res.Marker }
  })
  return items
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const instances = await describe(ctx)
  const rows = instances.map((d) => ({
    id: d.DBInstanceIdentifier ?? '',
    name: d.DBInstanceIdentifier ?? '',
    tones: { status: stateTone(d.DBInstanceStatus) },
    cells: {
      name: d.DBInstanceIdentifier ?? '',
      engine: join([d.Engine, d.EngineVersion], ' '),
      class: d.DBInstanceClass ?? '',
      status: d.DBInstanceStatus ?? '',
      storage: d.AllocatedStorage ? d.AllocatedStorage * 1024 * 1024 * 1024 : null,
      multiAz: d.MultiAZ ?? false,
      endpoint: d.Endpoint?.Address ?? ''
    }
  }))
  return {
    columns: [
      { key: 'name', label: 'Identifier', primary: true },
      { key: 'engine', label: 'Engine', kind: 'mono' },
      { key: 'class', label: 'Class', kind: 'mono' },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'storage', label: 'Storage', kind: 'bytes', align: 'right' },
      { key: 'multiAz', label: 'Multi-AZ', kind: 'bool' },
      { key: 'endpoint', label: 'Endpoint', kind: 'mono' }
    ],
    rows
  }
}

function dbMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'DBInstanceIdentifier', value: id }]
  return [
    { label: 'CPU %', namespace: 'AWS/RDS', metricName: 'CPUUtilization', stat: 'Average', unit: 'Percent', dimensions: d },
    { label: 'Connections', namespace: 'AWS/RDS', metricName: 'DatabaseConnections', stat: 'Average', unit: 'Count', dimensions: d },
    { label: 'Freeable Memory', namespace: 'AWS/RDS', metricName: 'FreeableMemory', stat: 'Average', unit: 'Bytes', dimensions: d },
    { label: 'Free Storage', namespace: 'AWS/RDS', metricName: 'FreeStorageSpace', stat: 'Average', unit: 'Bytes', dimensions: d },
    { label: 'Read IOPS', namespace: 'AWS/RDS', metricName: 'ReadIOPS', stat: 'Average', unit: 'Count/Second', dimensions: d },
    { label: 'Write IOPS', namespace: 'AWS/RDS', metricName: 'WriteIOPS', stat: 'Average', unit: 'Count/Second', dimensions: d },
    { label: 'Read Latency', namespace: 'AWS/RDS', metricName: 'ReadLatency', stat: 'Average', unit: 'Seconds', dimensions: d },
    { label: 'Write Latency', namespace: 'AWS/RDS', metricName: 'WriteLatency', stat: 'Average', unit: 'Seconds', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const [db] = await describe(ctx, id)
  if (!db) throw new Error(`DB instance ${id} not found in ${ctx.region}.`)

  return {
    id,
    name: id,
    service: 'rds',
    type: 'db-instance',
    region: ctx.region,
    status: db.DBInstanceStatus,
    statusTone: stateTone(db.DBInstanceStatus),
    tags: tagsToRecord(db.TagList),
    metrics: dbMetrics(id),
    related: db.DBClusterIdentifier ? [{ service: 'rds-clusters', label: 'Cluster', id: db.DBClusterIdentifier }] : [],
    sections: [
      section('Engine', [
        field('Identifier', id, 'mono'),
        field('Engine', join([db.Engine, db.EngineVersion], ' ')),
        field('Class', db.DBInstanceClass, 'mono'),
        field('Status', db.DBInstanceStatus, 'badge', { tone: stateTone(db.DBInstanceStatus) }),
        field('License', db.LicenseModel)
      ]),
      section('Storage', [
        field('Allocated', db.AllocatedStorage ? db.AllocatedStorage * 1024 ** 3 : null, 'bytes'),
        field('Type', db.StorageType, 'mono'),
        field('IOPS', db.Iops ?? null, 'number'),
        field('Encrypted', db.StorageEncrypted ?? false, 'bool')
      ]),
      section('Networking', [
        field('Endpoint', db.Endpoint?.Address, 'mono'),
        field('Port', db.Endpoint?.Port ?? null, 'number'),
        field('Multi-AZ', db.MultiAZ ?? false, 'bool'),
        field('Availability Zone', db.AvailabilityZone),
        field('Publicly accessible', db.PubliclyAccessible ?? false, 'bool', ),
        field('VPC', db.DBSubnetGroup?.VpcId, 'mono')
      ]),
      section('Backup', [
        field('Retention (days)', db.BackupRetentionPeriod ?? null, 'number'),
        field('Window', db.PreferredBackupWindow),
        field('Maintenance window', db.PreferredMaintenanceWindow),
        field('Created', db.InstanceCreateTime ? new Date(db.InstanceCreateTime).toISOString() : null, 'datetime')
      ])
    ],
    raw: db
  }
}
