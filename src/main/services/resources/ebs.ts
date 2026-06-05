/** EBS volumes — list + detail with live CloudWatch charts. */
import { EC2Client, DescribeVolumesCommand } from '@aws-sdk/client-ec2'
import type { Volume } from '@aws-sdk/client-ec2'
import { getClient } from '../aws'
import { field, nameFromTags, paginate, section, stateTone, tagsToRecord } from './util'
import type { AwsCtx, MetricSpecDTO, RelatedRef, ResourceDetailResult, ResourceListResult } from '@shared/types'

async function describe(ctx: AwsCtx, ids?: string[]): Promise<Volume[]> {
  const ec2 = getClient(EC2Client, ctx)
  const { items } = await paginate<Volume>(async (token) => {
    const res = await ec2.send(
      new DescribeVolumesCommand({ VolumeIds: ids, NextToken: token, MaxResults: ids ? undefined : 500 })
    )
    return { items: res.Volumes ?? [], next: res.NextToken }
  })
  return items
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const volumes = await describe(ctx)
  const rows = volumes.map((v) => ({
    id: v.VolumeId ?? '',
    name: nameFromTags(v.Tags) ?? v.VolumeId ?? '',
    tags: tagsToRecord(v.Tags),
    tones: { state: stateTone(v.State) },
    cells: {
      name: nameFromTags(v.Tags) ?? v.VolumeId ?? '',
      id: v.VolumeId ?? '',
      state: v.State ?? '',
      type: v.VolumeType ?? '',
      size: v.Size ? v.Size * 1024 ** 3 : null,
      iops: v.Iops ?? null,
      az: v.AvailabilityZone ?? '',
      attached: v.Attachments?.[0]?.InstanceId ?? '—'
    }
  }))
  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'id', label: 'Volume ID', kind: 'mono' },
      { key: 'state', label: 'State', kind: 'badge' },
      { key: 'type', label: 'Type', kind: 'mono' },
      { key: 'size', label: 'Size', kind: 'bytes', align: 'right' },
      { key: 'iops', label: 'IOPS', kind: 'number', align: 'right' },
      { key: 'az', label: 'AZ' },
      { key: 'attached', label: 'Attached', kind: 'mono' }
    ],
    rows
  }
}

function volumeMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'VolumeId', value: id }]
  return [
    { label: 'Read Bytes', namespace: 'AWS/EBS', metricName: 'VolumeReadBytes', stat: 'Sum', unit: 'Bytes', dimensions: d },
    { label: 'Write Bytes', namespace: 'AWS/EBS', metricName: 'VolumeWriteBytes', stat: 'Sum', unit: 'Bytes', dimensions: d },
    { label: 'Read Ops', namespace: 'AWS/EBS', metricName: 'VolumeReadOps', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Write Ops', namespace: 'AWS/EBS', metricName: 'VolumeWriteOps', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Queue Length', namespace: 'AWS/EBS', metricName: 'VolumeQueueLength', stat: 'Average', unit: 'Count', dimensions: d },
    { label: 'Burst Balance', namespace: 'AWS/EBS', metricName: 'BurstBalance', stat: 'Average', unit: 'Percent', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const [volume] = await describe(ctx, [id])
  if (!volume) throw new Error(`Volume ${id} not found in ${ctx.region}.`)

  const att = volume.Attachments?.[0]
  const related: RelatedRef[] = att?.InstanceId
    ? [{ service: 'ec2', label: 'Instance', id: att.InstanceId }]
    : []

  return {
    id,
    name: nameFromTags(volume.Tags) ?? id,
    service: 'ebs',
    type: 'volume',
    region: ctx.region,
    status: volume.State,
    statusTone: stateTone(volume.State),
    tags: tagsToRecord(volume.Tags),
    metrics: volumeMetrics(id),
    related,
    sections: [
      section('Volume', [
        field('Volume ID', id, 'mono'),
        field('Type', volume.VolumeType, 'mono'),
        field('Size', volume.Size ? volume.Size * 1024 ** 3 : null, 'bytes'),
        field('IOPS', volume.Iops ?? null, 'number'),
        field('Throughput', volume.Throughput ?? null, 'number'),
        field('Encrypted', volume.Encrypted ?? false, 'bool'),
        field('KMS key', volume.KmsKeyId ?? null, 'mono'),
        field('State', volume.State, 'badge', { tone: stateTone(volume.State) })
      ]),
      section('Attachment', [
        field('Instance ID', att?.InstanceId, 'mono'),
        field('Device', att?.Device, 'mono'),
        field('State', att?.State, 'badge', { tone: stateTone(att?.State) }),
        field('Delete on termination', att?.DeleteOnTermination ?? false, 'bool')
      ]),
      section('Source', [
        field('Snapshot ID', volume.SnapshotId, 'mono'),
        field('Created', volume.CreateTime ? new Date(volume.CreateTime).toISOString() : null, 'datetime')
      ])
    ],
    raw: volume
  }
}
