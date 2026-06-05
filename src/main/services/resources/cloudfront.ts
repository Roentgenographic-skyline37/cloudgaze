/** CloudFront distributions — global list + detail of origins, aliases and default behavior. */
import { CloudFrontClient, ListDistributionsCommand, GetDistributionCommand } from '@aws-sdk/client-cloudfront'
import type { DistributionSummary } from '@aws-sdk/client-cloudfront'
import { getClient } from '../aws'
import { field, join, paginate, section, stateTone } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const cf = getClient(CloudFrontClient, ctx, { global: true })
  const { items: dists } = await paginate<DistributionSummary>(async (token) => {
    const res = await cf.send(new ListDistributionsCommand({ Marker: token }))
    const list = res.DistributionList
    return { items: list?.Items ?? [], next: list?.IsTruncated ? list.NextMarker : undefined }
  })

  const rows = dists.map((d) => ({
    id: d.Id ?? '',
    name: d.Id ?? '',
    tones: { status: stateTone(d.Status) },
    cells: {
      id: d.Id ?? '',
      domain: d.DomainName ?? '',
      status: d.Status ?? '',
      enabled: d.Enabled ?? false,
      aliases: join(d.Aliases?.Items ?? [], ', '),
      priceClass: d.PriceClass ?? ''
    }
  }))

  return {
    columns: [
      { key: 'id', label: 'ID', primary: true, kind: 'mono' },
      { key: 'domain', label: 'Domain', kind: 'mono' },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'enabled', label: 'Enabled', kind: 'bool' },
      { key: 'aliases', label: 'Aliases' },
      { key: 'priceClass', label: 'Price class' }
    ],
    rows,
    note: 'CloudFront is a global service — the region selector does not filter this list.'
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const cf = getClient(CloudFrontClient, ctx, { global: true })
  const res = await cf.send(new GetDistributionCommand({ Id: id }))
  const d = res.Distribution
  if (!d) throw new Error(`Distribution ${id} not found.`)
  const cfg = d.DistributionConfig

  return {
    id,
    name: id,
    service: 'cloudfront',
    type: 'distribution',
    region: ctx.region,
    status: d.Status,
    statusTone: stateTone(d.Status),
    tags: {},
    sections: [
      section('Distribution', [
        field('ID', id, 'mono'),
        field('Domain', d.DomainName, 'mono'),
        field('Status', d.Status, 'badge', { tone: stateTone(d.Status) }),
        field('Enabled', cfg?.Enabled ?? null, 'bool'),
        field('Price class', cfg?.PriceClass),
        field('HTTP version', cfg?.HttpVersion),
        field('Last modified', d.LastModifiedTime ? new Date(d.LastModifiedTime).toISOString() : null, 'datetime')
      ]),
      section('Aliases', [field('Aliases', join(cfg?.Aliases?.Items ?? [], ', '))]),
      section(
        'Origins',
        (cfg?.Origins?.Items ?? []).map((o) => field(o.Id ?? 'origin', o.DomainName))
      ),
      section('Default behavior', [
        field('Viewer protocol policy', cfg?.DefaultCacheBehavior?.ViewerProtocolPolicy),
        field('Target origin', cfg?.DefaultCacheBehavior?.TargetOriginId)
      ])
    ],
    raw: d
  }
}
