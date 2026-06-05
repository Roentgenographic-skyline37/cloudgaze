/** IAM customer-managed policies — global list + detail (metadata only). */
import { IAMClient, ListPoliciesCommand, GetPolicyCommand } from '@aws-sdk/client-iam'
import type { Policy } from '@aws-sdk/client-iam'
import { getClient } from '../aws'
import { field, paginate, section, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const iam = getClient(IAMClient, ctx, { global: true })
  const { items, truncated } = await paginate<Policy>(async (token) => {
    const res = await iam.send(new ListPoliciesCommand({ Scope: 'Local', Marker: token }))
    return { items: res.Policies ?? [], next: res.IsTruncated ? res.Marker : undefined }
  })

  const rows = items.map((p) => ({
    id: p.Arn ?? '',
    name: p.PolicyName ?? '',
    cells: {
      name: p.PolicyName ?? '',
      id: p.PolicyId ?? '',
      attachments: p.AttachmentCount ?? null,
      created: p.CreateDate ? new Date(p.CreateDate).toISOString() : null,
      updated: p.UpdateDate ? new Date(p.UpdateDate).toISOString() : null,
      arn: p.Arn ?? ''
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Policy', primary: true },
      { key: 'id', label: 'Policy ID', kind: 'mono' },
      { key: 'attachments', label: 'Attachments', kind: 'number', align: 'right' },
      { key: 'created', label: 'Created', kind: 'ago', align: 'right' },
      { key: 'updated', label: 'Updated', kind: 'ago', align: 'right' },
      { key: 'arn', label: 'ARN', kind: 'arn' }
    ],
    rows,
    truncated,
    note: 'IAM is a global service — the region selector does not filter this list.'
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const iam = getClient(IAMClient, ctx, { global: true })
  const res = await iam.send(new GetPolicyCommand({ PolicyArn: id }))
  const p = res.Policy

  return {
    id,
    name: p?.PolicyName ?? id,
    service: 'iam-policies',
    type: 'policy',
    region: ctx.region,
    tags: tagsToRecord(p?.Tags),
    sections: [
      section('Policy', [
        field('Name', p?.PolicyName),
        field('Policy ID', p?.PolicyId, 'mono'),
        field('ARN', id, 'arn'),
        field('Attachments', p?.AttachmentCount ?? null, 'number'),
        field('Default version', p?.DefaultVersionId),
        field('Created', p?.CreateDate ? new Date(p.CreateDate).toISOString() : null, 'datetime'),
        field('Updated', p?.UpdateDate ? new Date(p.UpdateDate).toISOString() : null, 'datetime')
      ]),
      section('Description', [field('Description', p?.Description)])
    ],
    raw: p
  }
}
