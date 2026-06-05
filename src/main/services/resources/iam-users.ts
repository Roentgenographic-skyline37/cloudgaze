/** IAM users — global list + detail with policies, groups, MFA and access keys. */
import {
  IAMClient,
  ListUsersCommand,
  GetUserCommand,
  ListAttachedUserPoliciesCommand,
  ListGroupsForUserCommand,
  ListMFADevicesCommand,
  ListAccessKeysCommand
} from '@aws-sdk/client-iam'
import type { User } from '@aws-sdk/client-iam'
import { getClient } from '../aws'
import { field, join, paginate, section, settle, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const iam = getClient(IAMClient, ctx, { global: true })
  const { items, truncated } = await paginate<User>(async (token) => {
    const res = await iam.send(new ListUsersCommand({ Marker: token }))
    return { items: res.Users ?? [], next: res.IsTruncated ? res.Marker : undefined }
  })

  const rows = items.map((u) => ({
    id: u.UserName ?? '',
    name: u.UserName ?? '',
    cells: {
      name: u.UserName ?? '',
      id: u.UserId ?? '',
      created: u.CreateDate ? new Date(u.CreateDate).toISOString() : null,
      passwordLastUsed: u.PasswordLastUsed ? new Date(u.PasswordLastUsed).toISOString() : null,
      arn: u.Arn ?? ''
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'User', primary: true },
      { key: 'id', label: 'User ID', kind: 'mono' },
      { key: 'created', label: 'Created', kind: 'ago', align: 'right' },
      { key: 'passwordLastUsed', label: 'Password last used', kind: 'ago', align: 'right' },
      { key: 'arn', label: 'ARN', kind: 'arn' }
    ],
    rows,
    truncated,
    note: 'IAM is a global service — the region selector does not filter this list.'
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const iam = getClient(IAMClient, ctx, { global: true })
  const res = await iam.send(new GetUserCommand({ UserName: id }))
  const u = res.User

  const [attached, groups, mfa, keys] = await Promise.all([
    settle(iam.send(new ListAttachedUserPoliciesCommand({ UserName: id })), undefined),
    settle(iam.send(new ListGroupsForUserCommand({ UserName: id })), undefined),
    settle(iam.send(new ListMFADevicesCommand({ UserName: id })), undefined),
    settle(iam.send(new ListAccessKeysCommand({ UserName: id })), undefined)
  ])

  return {
    id,
    name: u?.UserName ?? id,
    service: 'iam-users',
    type: 'user',
    region: ctx.region,
    tags: tagsToRecord(u?.Tags),
    sections: [
      section('User', [
        field('Name', u?.UserName),
        field('User ID', u?.UserId, 'mono'),
        field('ARN', u?.Arn, 'arn'),
        field('Created', u?.CreateDate ? new Date(u.CreateDate).toISOString() : null, 'datetime'),
        field('Password last used', u?.PasswordLastUsed ? new Date(u.PasswordLastUsed).toISOString() : null, 'ago'),
        field('Path', u?.Path)
      ]),
      section('Access', [
        field('Attached policies', attached?.AttachedPolicies?.length ?? null, 'number'),
        field('Groups', join((groups?.Groups ?? []).map((g) => g.GroupName), ', ')),
        field('MFA devices', mfa?.MFADevices?.length ?? null, 'number'),
        field('Access keys', keys?.AccessKeyMetadata?.length ?? null, 'number')
      ])
    ],
    raw: u
  }
}
