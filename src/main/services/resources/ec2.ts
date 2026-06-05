/** EC2 instances — list + rich detail with live CloudWatch charts. */
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2'
import type { Instance } from '@aws-sdk/client-ec2'
import { getClient } from '../aws'
import { field, join, nameFromTags, paginate, section, stateTone, tagsToRecord } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

async function describeAll(ctx: AwsCtx, instanceIds?: string[]): Promise<Instance[]> {
  const ec2 = getClient(EC2Client, ctx)
  const { items } = await paginate<Instance>(async (token) => {
    const res = await ec2.send(
      new DescribeInstancesCommand({ InstanceIds: instanceIds, NextToken: token, MaxResults: instanceIds ? undefined : 1000 })
    )
    const flat = (res.Reservations ?? []).flatMap((r) => r.Instances ?? [])
    return { items: flat, next: res.NextToken }
  })
  return items
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const instances = await describeAll(ctx)
  const rows = instances.map((i) => {
    const state = i.State?.Name
    return {
      id: i.InstanceId ?? '',
      name: nameFromTags(i.Tags) ?? i.InstanceId ?? '',
      tags: tagsToRecord(i.Tags),
      tones: { state: stateTone(state) },
      cells: {
        name: nameFromTags(i.Tags) ?? i.InstanceId ?? '',
        id: i.InstanceId ?? '',
        state: state ?? 'unknown',
        type: i.InstanceType ?? '',
        az: i.Placement?.AvailabilityZone ?? '',
        privateIp: i.PrivateIpAddress ?? '',
        publicIp: i.PublicIpAddress ?? '',
        launched: i.LaunchTime ? new Date(i.LaunchTime).toISOString() : null
      }
    }
  })
  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'id', label: 'Instance ID', kind: 'mono' },
      { key: 'state', label: 'State', kind: 'badge' },
      { key: 'type', label: 'Type', kind: 'mono' },
      { key: 'az', label: 'AZ' },
      { key: 'privateIp', label: 'Private IP', kind: 'mono' },
      { key: 'publicIp', label: 'Public IP', kind: 'mono' },
      { key: 'launched', label: 'Launched', kind: 'ago', align: 'right' }
    ],
    rows
  }
}

function instanceMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'InstanceId', value: id }]
  return [
    { label: 'CPU %', namespace: 'AWS/EC2', metricName: 'CPUUtilization', stat: 'Average', unit: 'Percent', dimensions: d },
    { label: 'Network In', namespace: 'AWS/EC2', metricName: 'NetworkIn', stat: 'Average', unit: 'Bytes', dimensions: d },
    { label: 'Network Out', namespace: 'AWS/EC2', metricName: 'NetworkOut', stat: 'Average', unit: 'Bytes', dimensions: d },
    { label: 'Disk Read', namespace: 'AWS/EC2', metricName: 'DiskReadBytes', stat: 'Sum', unit: 'Bytes', dimensions: d },
    { label: 'Disk Write', namespace: 'AWS/EC2', metricName: 'DiskWriteBytes', stat: 'Sum', unit: 'Bytes', dimensions: d },
    { label: 'Status Check Failed', namespace: 'AWS/EC2', metricName: 'StatusCheckFailed', stat: 'Maximum', unit: 'Count', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const [inst] = await describeAll(ctx, [id])
  if (!inst) throw new Error(`Instance ${id} not found in ${ctx.region}.`)

  const state = inst.State?.Name
  const sgs = inst.SecurityGroups ?? []

  return {
    id,
    name: nameFromTags(inst.Tags) ?? id,
    service: 'ec2',
    type: 'instance',
    region: ctx.region,
    status: state,
    statusTone: stateTone(state),
    tags: tagsToRecord(inst.Tags),
    metrics: instanceMetrics(id),
    related: [
      ...(inst.VpcId ? [{ service: 'vpc', label: 'VPC', id: inst.VpcId }] : []),
      ...(inst.SubnetId ? [{ service: 'subnet', label: 'Subnet', id: inst.SubnetId }] : []),
      ...sgs.map((g) => ({ service: 'security-group', label: g.GroupName ?? 'SG', id: g.GroupId ?? '' }))
    ],
    sections: [
      section('Identity', [
        field('Instance ID', id, 'mono'),
        field('State', state, 'badge', { tone: stateTone(state) }),
        field('Type', inst.InstanceType, 'mono'),
        field('Architecture', inst.Architecture),
        field('Platform', inst.PlatformDetails ?? 'Linux/UNIX'),
        field('AMI', inst.ImageId, 'mono'),
        field('Key pair', inst.KeyName),
        field('IAM profile', inst.IamInstanceProfile?.Arn ? inst.IamInstanceProfile.Arn : null, 'arn')
      ]),
      section('Networking', [
        field('VPC', inst.VpcId, 'mono'),
        field('Subnet', inst.SubnetId, 'mono'),
        field('Availability Zone', inst.Placement?.AvailabilityZone),
        field('Private IP', inst.PrivateIpAddress, 'mono'),
        field('Private DNS', inst.PrivateDnsName, 'mono'),
        field('Public IP', inst.PublicIpAddress, 'mono'),
        field('Public DNS', inst.PublicDnsName, 'mono'),
        field('Security groups', join(sgs.map((g) => `${g.GroupName} (${g.GroupId})`), ', '))
      ]),
      section('Lifecycle', [
        field('Launched', inst.LaunchTime ? new Date(inst.LaunchTime).toISOString() : null, 'datetime'),
        field('Monitoring', inst.Monitoring?.State),
        field('Tenancy', inst.Placement?.Tenancy),
        field('EBS optimized', inst.EbsOptimized ?? null, 'bool'),
        field('Root device', join([inst.RootDeviceName, inst.RootDeviceType])),
        field('Volumes', String((inst.BlockDeviceMappings ?? []).length))
      ])
    ],
    raw: inst
  }
}
