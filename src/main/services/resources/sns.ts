/** SNS topics — list + detail (subscriptions, encryption, publish metrics). */
import {
  SNSClient,
  ListTopicsCommand,
  GetTopicAttributesCommand,
  ListTagsForResourceCommand
} from '@aws-sdk/client-sns'
import type { Topic } from '@aws-sdk/client-sns'
import { getClient } from '../aws'
import { field, mapLimit, paginate, section, settle, tagsToRecord } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const sns = getClient(SNSClient, ctx)
  const { items, truncated } = await paginate<Topic>(async (token) => {
    const res = await sns.send(new ListTopicsCommand({ NextToken: token }))
    return { items: res.Topics ?? [], next: res.NextToken }
  })

  const enriched = await mapLimit(items, 12, (t) =>
    settle(sns.send(new GetTopicAttributesCommand({ TopicArn: t.TopicArn })), undefined)
  )

  const rows = items.map((t, i) => {
    const arn = t.TopicArn ?? ''
    const A = enriched[i]?.Attributes ?? {}
    return {
      id: arn,
      name: arn.split(':').pop() ?? arn,
      cells: {
        name: arn.split(':').pop() ?? arn,
        arn,
        subscriptions: A.SubscriptionsConfirmed != null ? Number(A.SubscriptionsConfirmed) : null,
        pending: A.SubscriptionsPending != null ? Number(A.SubscriptionsPending) : null,
        type: A.FifoTopic === 'true' ? 'FIFO' : 'Standard'
      }
    }
  })

  return {
    columns: [
      { key: 'name', label: 'Topic', primary: true },
      { key: 'arn', label: 'ARN', kind: 'mono' },
      { key: 'subscriptions', label: 'Subscriptions', kind: 'number', align: 'right' },
      { key: 'pending', label: 'Pending', kind: 'number', align: 'right' },
      { key: 'type', label: 'Type' }
    ],
    rows,
    truncated
  }
}

function topicMetrics(name: string): MetricSpecDTO[] {
  const d = [{ name: 'TopicName', value: name }]
  return [
    { label: 'Messages Published', namespace: 'AWS/SNS', metricName: 'NumberOfMessagesPublished', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Notifications Delivered', namespace: 'AWS/SNS', metricName: 'NumberOfNotificationsDelivered', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Notifications Failed', namespace: 'AWS/SNS', metricName: 'NumberOfNotificationsFailed', stat: 'Sum', unit: 'Count', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const sns = getClient(SNSClient, ctx)
  const res = await sns.send(new GetTopicAttributesCommand({ TopicArn: id }))
  const A = res.Attributes ?? {}

  const tagsRes = await settle(
    sns.send(new ListTagsForResourceCommand({ ResourceArn: id })),
    undefined
  )

  return {
    id,
    name: id.split(':').pop() ?? id,
    service: 'sns',
    type: 'topic',
    region: ctx.region,
    tags: tagsToRecord(tagsRes?.Tags),
    metrics: topicMetrics(id.split(':').pop()!),
    sections: [
      section('Topic', [
        field('Name', id.split(':').pop()),
        field('ARN', id, 'mono'),
        field('Display name', A.DisplayName),
        field('Owner', A.Owner),
        field('Type', A.FifoTopic === 'true' ? 'FIFO' : 'Standard')
      ]),
      section('Subscriptions', [
        field('Confirmed', A.SubscriptionsConfirmed != null ? Number(A.SubscriptionsConfirmed) : null, 'number'),
        field('Pending', A.SubscriptionsPending != null ? Number(A.SubscriptionsPending) : null, 'number'),
        field('Deleted', A.SubscriptionsDeleted != null ? Number(A.SubscriptionsDeleted) : null, 'number')
      ]),
      section('Encryption', [field('KMS master key', A.KmsMasterKeyId, 'mono')])
    ],
    raw: A
  }
}
