/** EBS snapshots (owned by this account) — list + detail. */
import { EC2Client, DescribeSnapshotsCommand } from '@aws-sdk/client-ec2'
import type { Snapshot } from '@aws-sdk/client-ec2'
import { getClient } from '../aws'
import { field, paginate, section, stateTone, tagsToRecord } from './util'
import type { AwsCtx, RelatedRef, ResourceDetailResult, ResourceListResult } from '@shared/types'

async function describe(ctx: AwsCtx, ids?: string[]): Promise<Snapshot[]> {
  const ec2 = getClient(EC2Client, ctx)
  const { items } = await paginate<Snapshot>(async (token) => {
    const res = await ec2.send(
      new DescribeSnapshotsCommand({
        OwnerIds: ['self'],
        SnapshotIds: ids,
        NextToken: token,
        MaxResults: ids ? undefined : 500
      })
    )
    return { items: res.Snapshots ?? [], next: res.NextToken }
  })
  return items
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const snapshots = await describe(ctx)
  const rows = snapshots.map((s) => ({
    id: s.SnapshotId ?? '',
    name: s.SnapshotId ?? '',
    tags: tagsToRecord(s.Tags),
    tones: { state: stateTone(s.State) },
    cells: {
      id: s.SnapshotId ?? '',
      state: s.State ?? '',
      volumeId: s.VolumeId ?? '',
      size: s.VolumeSize ? s.VolumeSize * 1024 ** 3 : null,
      progress: s.Progress ?? '',
      encrypted: s.Encrypted ?? false,
      started: s.StartTime ? new Date(s.StartTime).toISOString() : null,
      description: s.Description ?? ''
    }
  }))
  return {
    columns: [
      { key: 'id', label: 'Snapshot ID', primary: true, kind: 'mono' },
      { key: 'state', label: 'State', kind: 'badge' },
      { key: 'volumeId', label: 'Volume ID', kind: 'mono' },
      { key: 'size', label: 'Size', kind: 'bytes', align: 'right' },
      { key: 'progress', label: 'Progress' },
      { key: 'encrypted', label: 'Encrypted', kind: 'bool' },
      { key: 'started', label: 'Started', kind: 'ago', align: 'right' },
      { key: 'description', label: 'Description' }
    ],
    rows
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const [snapshot] = await describe(ctx, [id])
  if (!snapshot) throw new Error(`Snapshot ${id} not found in ${ctx.region}.`)

  const related: RelatedRef[] = snapshot.VolumeId
    ? [{ service: 'ebs', label: 'Volume', id: snapshot.VolumeId }]
    : []

  return {
    id,
    name: id,
    service: 'ebs-snapshots',
    type: 'snapshot',
    region: ctx.region,
    status: snapshot.State,
    statusTone: stateTone(snapshot.State),
    tags: tagsToRecord(snapshot.Tags),
    related,
    sections: [
      section('Snapshot', [
        field('Snapshot ID', id, 'mono'),
        field('State', snapshot.State, 'badge', { tone: stateTone(snapshot.State) }),
        field('Volume ID', snapshot.VolumeId, 'mono'),
        field('Size', snapshot.VolumeSize ? snapshot.VolumeSize * 1024 ** 3 : null, 'bytes'),
        field('Encrypted', snapshot.Encrypted ?? false, 'bool'),
        field('Progress', snapshot.Progress),
        field('Started', snapshot.StartTime ? new Date(snapshot.StartTime).toISOString() : null, 'datetime'),
        field('Description', snapshot.Description)
      ]),
      section('Source', [
        field('Owner ID', snapshot.OwnerId, 'mono'),
        field('Outpost ARN', snapshot.OutpostArn ?? null, 'arn')
      ])
    ],
    raw: snapshot
  }
}
