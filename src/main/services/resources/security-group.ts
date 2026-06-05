/** Security groups — list + detail with readable ingress/egress rules. */
import { EC2Client, DescribeSecurityGroupsCommand } from '@aws-sdk/client-ec2'
import type { IpPermission, SecurityGroup } from '@aws-sdk/client-ec2'
import { getClient } from '../aws'
import { field, paginate, section, tagsToRecord } from './util'
import type { AwsCtx, DetailField, RelatedRef, ResourceDetailResult, ResourceListResult } from '@shared/types'

async function describe(ctx: AwsCtx, ids?: string[]): Promise<SecurityGroup[]> {
  const ec2 = getClient(EC2Client, ctx)
  const { items } = await paginate<SecurityGroup>(async (token) => {
    const res = await ec2.send(new DescribeSecurityGroupsCommand({ GroupIds: ids, NextToken: token }))
    return { items: res.SecurityGroups ?? [], next: res.NextToken }
  })
  return items
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const groups = await describe(ctx)
  const rows = groups.map((g) => ({
    id: g.GroupId ?? '',
    name: g.GroupName ?? g.GroupId ?? '',
    tags: tagsToRecord(g.Tags),
    cells: {
      name: g.GroupName ?? '',
      id: g.GroupId ?? '',
      vpc: g.VpcId ?? '',
      description: g.Description ?? '',
      ingress: g.IpPermissions?.length ?? 0,
      egress: g.IpPermissionsEgress?.length ?? 0
    }
  }))
  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'id', label: 'Group ID', kind: 'mono' },
      { key: 'vpc', label: 'VPC', kind: 'mono' },
      { key: 'description', label: 'Description' },
      { key: 'ingress', label: 'Ingress', kind: 'number', align: 'right' },
      { key: 'egress', label: 'Egress', kind: 'number', align: 'right' }
    ],
    rows
  }
}

/** Turn one IP permission into a `{label, value}` pair (proto+ports → sources). */
function ruleField(p: IpPermission): DetailField {
  const proto = p.IpProtocol === '-1' ? 'all' : p.IpProtocol ?? 'all'
  const ports =
    p.FromPort === undefined || p.ToPort === undefined
      ? 'all'
      : p.FromPort === p.ToPort
        ? `${p.FromPort}`
        : `${p.FromPort}-${p.ToPort}`
  const sources = [
    ...(p.IpRanges ?? []).map((r) => r.CidrIp),
    ...(p.UserIdGroupPairs ?? []).map((g) => g.GroupId),
    ...(p.Ipv6Ranges ?? []).map((r) => r.CidrIpv6)
  ]
    .filter((s): s is string => Boolean(s))
    .join(',')
  return field(`${proto} ${ports}`, sources)
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const [group] = await describe(ctx, [id])
  if (!group) throw new Error(`Security group ${id} not found in ${ctx.region}.`)

  const related: RelatedRef[] = group.VpcId
    ? [{ service: 'vpc', label: 'VPC', id: group.VpcId }]
    : []

  return {
    id,
    name: group.GroupName ?? id,
    service: 'security-group',
    type: 'security-group',
    region: ctx.region,
    tags: tagsToRecord(group.Tags),
    related,
    sections: [
      section('Group', [
        field('Group ID', id, 'mono'),
        field('Name', group.GroupName),
        field('VPC', group.VpcId, 'mono'),
        field('Description', group.Description),
        field('Owner', group.OwnerId, 'mono')
      ]),
      section('Ingress rules', (group.IpPermissions ?? []).map(ruleField)),
      section('Egress rules', (group.IpPermissionsEgress ?? []).map(ruleField))
    ],
    raw: group
  }
}
