/** Subnets — list + detail. */
import { EC2Client, DescribeSubnetsCommand } from '@aws-sdk/client-ec2'
import type { Subnet } from '@aws-sdk/client-ec2'
import { getClient } from '../aws'
import { field, nameFromTags, paginate, section, stateTone, tagsToRecord } from './util'
import type { AwsCtx, RelatedRef, ResourceDetailResult, ResourceListResult } from '@shared/types'

async function describe(ctx: AwsCtx, ids?: string[]): Promise<Subnet[]> {
  const ec2 = getClient(EC2Client, ctx)
  const { items } = await paginate<Subnet>(async (token) => {
    const res = await ec2.send(new DescribeSubnetsCommand({ SubnetIds: ids, NextToken: token }))
    return { items: res.Subnets ?? [], next: res.NextToken }
  })
  return items
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const subnets = await describe(ctx)
  const rows = subnets.map((s) => ({
    id: s.SubnetId ?? '',
    name: nameFromTags(s.Tags) ?? s.SubnetId ?? '',
    tags: tagsToRecord(s.Tags),
    tones: { state: stateTone(s.State) },
    cells: {
      name: nameFromTags(s.Tags) ?? s.SubnetId ?? '',
      id: s.SubnetId ?? '',
      vpc: s.VpcId ?? '',
      az: s.AvailabilityZone ?? '',
      cidr: s.CidrBlock ?? '',
      availableIps: s.AvailableIpAddressCount ?? null,
      public: s.MapPublicIpOnLaunch ?? false,
      state: s.State ?? ''
    }
  }))
  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'id', label: 'Subnet ID', kind: 'mono' },
      { key: 'vpc', label: 'VPC', kind: 'mono' },
      { key: 'az', label: 'AZ' },
      { key: 'cidr', label: 'CIDR', kind: 'mono' },
      { key: 'availableIps', label: 'Available IPs', kind: 'number', align: 'right' },
      { key: 'public', label: 'Public', kind: 'bool' },
      { key: 'state', label: 'State', kind: 'badge' }
    ],
    rows
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const [subnet] = await describe(ctx, [id])
  if (!subnet) throw new Error(`Subnet ${id} not found in ${ctx.region}.`)

  const related: RelatedRef[] = subnet.VpcId
    ? [{ service: 'vpc', label: 'VPC', id: subnet.VpcId }]
    : []

  return {
    id,
    name: nameFromTags(subnet.Tags) ?? id,
    service: 'subnet',
    type: 'subnet',
    region: ctx.region,
    status: subnet.State,
    statusTone: stateTone(subnet.State),
    tags: tagsToRecord(subnet.Tags),
    related,
    sections: [
      section('Subnet', [
        field('Subnet ID', id, 'mono'),
        field('State', subnet.State, 'badge', { tone: stateTone(subnet.State) }),
        field('VPC', subnet.VpcId, 'mono'),
        field('Availability Zone', subnet.AvailabilityZone),
        field('CIDR', subnet.CidrBlock, 'mono'),
        field('Available IPs', subnet.AvailableIpAddressCount ?? null, 'number'),
        field('Public', subnet.MapPublicIpOnLaunch ?? false, 'bool'),
        field('Default for AZ', subnet.DefaultForAz ?? false, 'bool')
      ])
    ],
    raw: subnet
  }
}
