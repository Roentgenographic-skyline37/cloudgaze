/** Elastic IPs — list + detail. */
import { EC2Client, DescribeAddressesCommand } from '@aws-sdk/client-ec2'
import type { Address } from '@aws-sdk/client-ec2'
import { getClient } from '../aws'
import { field, nameFromTags, section, tagsToRecord } from './util'
import type { AwsCtx, RelatedRef, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const ec2 = getClient(EC2Client, ctx)
  const res = await ec2.send(new DescribeAddressesCommand({}))
  const addresses = res.Addresses ?? []
  const rows = addresses.map((a) => ({
    id: a.AllocationId ?? a.PublicIp ?? '',
    name: nameFromTags(a.Tags) ?? a.PublicIp ?? '',
    tags: tagsToRecord(a.Tags),
    cells: {
      name: nameFromTags(a.Tags) ?? a.PublicIp ?? '',
      publicIp: a.PublicIp ?? '',
      privateIp: a.PrivateIpAddress ?? '',
      instance: a.InstanceId ?? '—',
      domain: a.Domain ?? '',
      allocationId: a.AllocationId ?? ''
    }
  }))
  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'publicIp', label: 'Public IP', kind: 'mono' },
      { key: 'privateIp', label: 'Private IP', kind: 'mono' },
      { key: 'instance', label: 'Instance', kind: 'mono' },
      { key: 'domain', label: 'Domain' },
      { key: 'allocationId', label: 'Allocation ID', kind: 'mono' }
    ],
    rows
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const ec2 = getClient(EC2Client, ctx)
  const res = await ec2.send(
    new DescribeAddressesCommand(id.startsWith('eipalloc') ? { AllocationIds: [id] } : { PublicIps: [id] })
  )
  const address: Address | undefined = res.Addresses?.[0]
  if (!address) throw new Error(`Elastic IP ${id} not found in ${ctx.region}.`)

  const related: RelatedRef[] = address.InstanceId
    ? [{ service: 'ec2', label: 'Instance', id: address.InstanceId }]
    : []

  return {
    id,
    name: nameFromTags(address.Tags) ?? address.PublicIp ?? id,
    service: 'eip',
    type: 'elastic-ip',
    region: ctx.region,
    tags: tagsToRecord(address.Tags),
    related,
    sections: [
      section('Address', [
        field('Public IP', address.PublicIp, 'mono'),
        field('Allocation ID', address.AllocationId, 'mono'),
        field('Domain', address.Domain),
        field('Private IP', address.PrivateIpAddress, 'mono'),
        field('Network interface', address.NetworkInterfaceId, 'mono'),
        field('Association ID', address.AssociationId, 'mono')
      ]),
      section('Attachment', [
        field('Instance ID', address.InstanceId, 'mono'),
        field('Network interface owner', address.NetworkInterfaceOwnerId, 'mono')
      ])
    ],
    raw: address
  }
}
