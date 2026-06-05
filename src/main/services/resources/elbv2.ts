/** Application/Network/Gateway load balancers (ELBv2) — list + detail with target groups and ALB metrics. */
import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTagsCommand
} from '@aws-sdk/client-elastic-load-balancing-v2'
import type { LoadBalancer, TargetGroup } from '@aws-sdk/client-elastic-load-balancing-v2'
import { getClient } from '../aws'
import { field, join, paginate, section, settle, stateTone, tagsToRecord } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const elb = getClient(ElasticLoadBalancingV2Client, ctx)
  const { items: lbs } = await paginate<LoadBalancer>(async (token) => {
    const res = await elb.send(new DescribeLoadBalancersCommand({ Marker: token }))
    return { items: res.LoadBalancers ?? [], next: res.NextMarker }
  })

  const rows = lbs.map((lb) => ({
    id: lb.LoadBalancerArn ?? '',
    name: lb.LoadBalancerName ?? '',
    tags: {},
    tones: { state: stateTone(lb.State?.Code) },
    cells: {
      name: lb.LoadBalancerName ?? '',
      type: lb.Type ?? '',
      scheme: lb.Scheme ?? '',
      state: lb.State?.Code ?? '',
      dns: lb.DNSName ?? '',
      vpc: lb.VpcId ?? '',
      azs: lb.AvailabilityZones?.length ?? 0
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'type', label: 'Type' },
      { key: 'scheme', label: 'Scheme' },
      { key: 'state', label: 'State', kind: 'badge' },
      { key: 'dns', label: 'DNS name', kind: 'mono' },
      { key: 'vpc', label: 'VPC', kind: 'mono' },
      { key: 'azs', label: 'AZs', kind: 'number', align: 'right' }
    ],
    rows
  }
}

function albMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'LoadBalancer', value: id.split('loadbalancer/')[1] }]
  return [
    { label: 'Request count', namespace: 'AWS/ApplicationELB', metricName: 'RequestCount', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Target response time', namespace: 'AWS/ApplicationELB', metricName: 'TargetResponseTime', stat: 'Average', unit: 'Seconds', dimensions: d },
    { label: 'Target 5XX', namespace: 'AWS/ApplicationELB', metricName: 'HTTPCode_Target_5XX_Count', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'ELB 5XX', namespace: 'AWS/ApplicationELB', metricName: 'HTTPCode_ELB_5XX_Count', stat: 'Sum', unit: 'Count', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const elb = getClient(ElasticLoadBalancingV2Client, ctx)
  const res = await elb.send(new DescribeLoadBalancersCommand({ LoadBalancerArns: [id] }))
  const lb = res.LoadBalancers?.[0]
  if (!lb) throw new Error(`Load balancer ${id} not found in ${ctx.region}.`)

  const tgRes = await settle(
    elb.send(new DescribeTargetGroupsCommand({ LoadBalancerArn: id })),
    undefined
  )
  const targetGroups: TargetGroup[] = tgRes?.TargetGroups ?? []

  const tagRes = await settle(elb.send(new DescribeTagsCommand({ ResourceArns: [id] })), undefined)
  const tags = tagsToRecord(tagRes?.TagDescriptions?.[0]?.Tags)

  const state = lb.State?.Code

  return {
    id,
    name: lb.LoadBalancerName ?? id,
    service: 'elbv2',
    type: 'load-balancer',
    region: ctx.region,
    status: state,
    statusTone: stateTone(state),
    tags,
    ...(lb.Type === 'application' ? { metrics: albMetrics(id) } : {}),
    sections: [
      section('Load balancer', [
        field('Name', lb.LoadBalancerName),
        field('Type', lb.Type),
        field('Scheme', lb.Scheme),
        field('State', state, 'badge', { tone: stateTone(state) }),
        field('DNS name', lb.DNSName, 'mono'),
        field('IP address type', lb.IpAddressType),
        field('Created', lb.CreatedTime ? new Date(lb.CreatedTime).toISOString() : null, 'datetime')
      ]),
      section('Networking', [
        field('VPC', lb.VpcId, 'mono'),
        field('Availability zones', join((lb.AvailabilityZones ?? []).map((a) => a.ZoneName), ', ')),
        field('Security groups', join(lb.SecurityGroups ?? [], ', '))
      ]),
      section(
        'Target groups',
        targetGroups.map((tg) =>
          field(tg.TargetGroupName ?? 'target group', join([tg.Protocol, tg.Port, tg.TargetType]))
        )
      )
    ],
    raw: lb
  }
}
