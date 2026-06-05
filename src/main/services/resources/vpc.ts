/** VPCs — list + detail. */
import { EC2Client, DescribeVpcsCommand } from '@aws-sdk/client-ec2'
import type { Vpc } from '@aws-sdk/client-ec2'
import { getClient } from '../aws'
import { field, join, nameFromTags, paginate, section, stateTone, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

async function describe(ctx: AwsCtx, ids?: string[]): Promise<Vpc[]> {
  const ec2 = getClient(EC2Client, ctx)
  const { items } = await paginate<Vpc>(async (token) => {
    const res = await ec2.send(new DescribeVpcsCommand({ VpcIds: ids, NextToken: token }))
    return { items: res.Vpcs ?? [], next: res.NextToken }
  })
  return items
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const vpcs = await describe(ctx)
  const rows = vpcs.map((v) => ({
    id: v.VpcId ?? '',
    name: nameFromTags(v.Tags) ?? v.VpcId ?? '',
    tags: tagsToRecord(v.Tags),
    tones: { state: stateTone(v.State) },
    cells: {
      name: nameFromTags(v.Tags) ?? v.VpcId ?? '',
      id: v.VpcId ?? '',
      state: v.State ?? '',
      cidr: v.CidrBlock ?? '',
      default: v.IsDefault ?? false,
      tenancy: v.InstanceTenancy ?? ''
    }
  }))
  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'id', label: 'VPC ID', kind: 'mono' },
      { key: 'state', label: 'State', kind: 'badge' },
      { key: 'cidr', label: 'CIDR', kind: 'mono' },
      { key: 'default', label: 'Default', kind: 'bool' },
      { key: 'tenancy', label: 'Tenancy' }
    ],
    rows
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const [vpc] = await describe(ctx, [id])
  if (!vpc) throw new Error(`VPC ${id} not found in ${ctx.region}.`)

  return {
    id,
    name: nameFromTags(vpc.Tags) ?? id,
    service: 'vpc',
    type: 'vpc',
    region: ctx.region,
    status: vpc.State,
    statusTone: stateTone(vpc.State),
    tags: tagsToRecord(vpc.Tags),
    sections: [
      section('VPC', [
        field('VPC ID', id, 'mono'),
        field('State', vpc.State, 'badge', { tone: stateTone(vpc.State) }),
        field('Primary CIDR', vpc.CidrBlock, 'mono'),
        field('Default', vpc.IsDefault ?? false, 'bool'),
        field('Tenancy', vpc.InstanceTenancy),
        field('DHCP options', vpc.DhcpOptionsId, 'mono')
      ]),
      section('CIDR blocks', [
        field('CIDR blocks', join((vpc.CidrBlockAssociationSet ?? []).map((c) => c.CidrBlock), ', '))
      ])
    ],
    raw: vpc
  }
}
