/** Route 53 hosted zones — global list + detail with name servers and associated VPCs. */
import {
  Route53Client,
  ListHostedZonesCommand,
  GetHostedZoneCommand,
  ListTagsForResourceCommand
} from '@aws-sdk/client-route-53'
import type { HostedZone } from '@aws-sdk/client-route-53'
import { getClient } from '../aws'
import { field, join, paginate, section, settle, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

/** Strip the leading '/hostedzone/' prefix Route 53 returns on zone ids. */
function stripZoneId(id?: string): string {
  return (id ?? '').replace(/^\/hostedzone\//, '')
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const r53 = getClient(Route53Client, ctx, { global: true })
  const { items: zones } = await paginate<HostedZone>(async (token) => {
    const res = await r53.send(new ListHostedZonesCommand({ Marker: token }))
    return { items: res.HostedZones ?? [], next: res.IsTruncated ? res.NextMarker : undefined }
  })

  const rows = zones.map((z) => ({
    id: stripZoneId(z.Id),
    name: z.Name ?? '',
    cells: {
      name: z.Name ?? '',
      id: stripZoneId(z.Id),
      records: z.ResourceRecordSetCount ?? 0,
      private: z.Config?.PrivateZone ?? false,
      comment: z.Config?.Comment ?? ''
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'id', label: 'Zone ID', kind: 'mono' },
      { key: 'records', label: 'Records', kind: 'number', align: 'right' },
      { key: 'private', label: 'Private', kind: 'bool' },
      { key: 'comment', label: 'Comment' }
    ],
    rows,
    note: 'Route 53 is a global service — the region selector does not filter this list.'
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const r53 = getClient(Route53Client, ctx, { global: true })
  const res = await r53.send(new GetHostedZoneCommand({ Id: id }))
  const zone = res.HostedZone
  if (!zone) throw new Error(`Hosted zone ${id} not found.`)

  const tagRes = await settle(
    r53.send(new ListTagsForResourceCommand({ ResourceType: 'hostedzone', ResourceId: id })),
    undefined
  )
  const tags = tagsToRecord(tagRes?.ResourceTagSet?.Tags)

  return {
    id,
    name: zone.Name ?? id,
    service: 'route53',
    type: 'hosted-zone',
    region: ctx.region,
    tags,
    sections: [
      section('Hosted zone', [
        field('Name', zone.Name),
        field('Zone ID', id, 'mono'),
        field('Records', zone.ResourceRecordSetCount ?? null, 'number'),
        field('Private', zone.Config?.PrivateZone ?? null, 'bool'),
        field('Comment', zone.Config?.Comment)
      ]),
      section('Name servers', [field('Name servers', join(res.DelegationSet?.NameServers ?? [], ', '))]),
      section('VPCs', [
        field('Associated VPCs', join((res.VPCs ?? []).map((v) => `${v.VPCRegion}:${v.VPCId}`), ', '))
      ])
    ],
    raw: res
  }
}
