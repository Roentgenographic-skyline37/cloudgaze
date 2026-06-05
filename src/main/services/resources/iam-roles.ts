/** IAM roles — global list + detail with attached/inline policy counts. */
import {
  IAMClient,
  ListRolesCommand,
  GetRoleCommand,
  ListAttachedRolePoliciesCommand,
  ListRolePoliciesCommand
} from '@aws-sdk/client-iam'
import type { Role } from '@aws-sdk/client-iam'
import { getClient } from '../aws'
import { field, paginate, section, settle, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const iam = getClient(IAMClient, ctx, { global: true })
  const { items, truncated } = await paginate<Role>(async (token) => {
    const res = await iam.send(new ListRolesCommand({ Marker: token }))
    return { items: res.Roles ?? [], next: res.IsTruncated ? res.Marker : undefined }
  })

  const rows = items.map((r) => ({
    id: r.RoleName ?? '',
    name: r.RoleName ?? '',
    cells: {
      name: r.RoleName ?? '',
      id: r.RoleId ?? '',
      maxSession: r.MaxSessionDuration ?? null,
      created: r.CreateDate ? new Date(r.CreateDate).toISOString() : null,
      arn: r.Arn ?? ''
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Role', primary: true },
      { key: 'id', label: 'Role ID', kind: 'mono' },
      { key: 'maxSession', label: 'Max session (s)', kind: 'number', align: 'right' },
      { key: 'created', label: 'Created', kind: 'ago', align: 'right' },
      { key: 'arn', label: 'ARN', kind: 'arn' }
    ],
    rows,
    truncated,
    note: 'IAM is a global service — the region selector does not filter this list.'
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const iam = getClient(IAMClient, ctx, { global: true })
  const res = await iam.send(new GetRoleCommand({ RoleName: id }))
  const r = res.Role

  const [attached, inline] = await Promise.all([
    settle(iam.send(new ListAttachedRolePoliciesCommand({ RoleName: id })), undefined),
    settle(iam.send(new ListRolePoliciesCommand({ RoleName: id })), undefined)
  ])

  return {
    id,
    name: r?.RoleName ?? id,
    service: 'iam-roles',
    type: 'role',
    region: ctx.region,
    tags: tagsToRecord(r?.Tags),
    sections: [
      section('Role', [
        field('Name', r?.RoleName),
        field('Role ID', r?.RoleId, 'mono'),
        field('ARN', r?.Arn, 'arn'),
        field('Path', r?.Path),
        field('Max session', r?.MaxSessionDuration ?? null, 'number'),
        field('Created', r?.CreateDate ? new Date(r.CreateDate).toISOString() : null, 'datetime'),
        field('Last used', r?.RoleLastUsed?.LastUsedDate ? new Date(r.RoleLastUsed.LastUsedDate).toISOString() : null, 'ago')
      ]),
      section('Policies', [
        field('Attached managed', attached?.AttachedPolicies?.length ?? null, 'number'),
        field('Inline', inline?.PolicyNames?.length ?? null, 'number')
      ]),
      section('Description', [field('Description', r?.Description)])
    ],
    raw: r
  }
}
