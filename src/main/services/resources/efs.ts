/** EFS file systems — list + detail of storage, throughput and CloudWatch IO. */
import { EFSClient, DescribeFileSystemsCommand } from '@aws-sdk/client-efs'
import type { FileSystemDescription } from '@aws-sdk/client-efs'
import { getClient } from '../aws'
import { field, nameFromTags, paginate, section, stateTone, tagsToRecord } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

async function describe(ctx: AwsCtx, id?: string): Promise<FileSystemDescription[]> {
  const efs = getClient(EFSClient, ctx)
  const { items } = await paginate<FileSystemDescription>(async (token) => {
    const res = await efs.send(new DescribeFileSystemsCommand({ FileSystemId: id, Marker: token }))
    return { items: res.FileSystems ?? [], next: res.NextMarker }
  })
  return items
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const systems = await describe(ctx)
  const rows = systems.map((f) => ({
    id: f.FileSystemId ?? '',
    name: f.Name ?? nameFromTags(f.Tags) ?? f.FileSystemId ?? '',
    tags: tagsToRecord(f.Tags),
    tones: { state: stateTone(f.LifeCycleState) },
    cells: {
      name: f.Name ?? nameFromTags(f.Tags) ?? f.FileSystemId ?? '',
      id: f.FileSystemId ?? '',
      state: f.LifeCycleState ?? '',
      size: f.SizeInBytes?.Value ?? null,
      mode: f.PerformanceMode ?? '',
      throughput: f.ThroughputMode ?? '',
      encrypted: f.Encrypted ?? false
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'id', label: 'File system ID', kind: 'mono' },
      { key: 'state', label: 'State', kind: 'badge' },
      { key: 'size', label: 'Size', kind: 'bytes', align: 'right' },
      { key: 'mode', label: 'Performance mode' },
      { key: 'throughput', label: 'Throughput mode' },
      { key: 'encrypted', label: 'Encrypted', kind: 'bool' }
    ],
    rows
  }
}

function fsMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'FileSystemId', value: id }]
  return [
    { label: 'Percent IO Limit', namespace: 'AWS/EFS', metricName: 'PercentIOLimit', stat: 'Average', unit: 'Percent', dimensions: d },
    { label: 'Client Connections', namespace: 'AWS/EFS', metricName: 'ClientConnections', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Total IO Bytes', namespace: 'AWS/EFS', metricName: 'TotalIOBytes', stat: 'Sum', unit: 'Bytes', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const [fs] = await describe(ctx, id)
  if (!fs) throw new Error(`EFS file system ${id} not found in ${ctx.region}.`)

  return {
    id,
    name: fs.Name ?? nameFromTags(fs.Tags) ?? id,
    service: 'efs',
    type: 'file-system',
    region: ctx.region,
    status: fs.LifeCycleState,
    statusTone: stateTone(fs.LifeCycleState),
    tags: tagsToRecord(fs.Tags),
    metrics: fsMetrics(id),
    sections: [
      section('File system', [
        field('ID', fs.FileSystemId, 'mono'),
        field('Name', fs.Name ?? nameFromTags(fs.Tags)),
        field('State', fs.LifeCycleState, 'badge', { tone: stateTone(fs.LifeCycleState) }),
        field('Created', fs.CreationTime ? new Date(fs.CreationTime).toISOString() : null, 'datetime'),
        field('Owner', fs.OwnerId)
      ]),
      section('Storage', [
        field('Size', fs.SizeInBytes?.Value ?? null, 'bytes'),
        field('Performance mode', fs.PerformanceMode),
        field('Throughput mode', fs.ThroughputMode),
        field('Provisioned throughput', fs.ProvisionedThroughputInMibps ?? null, 'number'),
        field('Encrypted', fs.Encrypted ?? false, 'bool'),
        field('KMS key', fs.KmsKeyId, 'mono')
      ]),
      section('Mounts', [field('Mount targets', fs.NumberOfMountTargets ?? null, 'number')])
    ],
    raw: fs
  }
}
