/** SQS queues — list + detail (message counts, config, encryption, metrics). */
import {
  SQSClient,
  ListQueuesCommand,
  GetQueueAttributesCommand,
  ListQueueTagsCommand
} from '@aws-sdk/client-sqs'
import { getClient } from '../aws'
import { field, mapLimit, paginate, section, settle } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const sqs = getClient(SQSClient, ctx)
  const { items, truncated } = await paginate<string>(async (token) => {
    const res = await sqs.send(new ListQueuesCommand({ NextToken: token }))
    return { items: res.QueueUrls ?? [], next: res.NextToken }
  })

  const enriched = await mapLimit(items, 12, (url) =>
    settle(sqs.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ['All'] })), undefined)
  )

  const rows = items.map((url, i) => {
    const A = enriched[i]?.Attributes ?? {}
    return {
      id: url,
      name: url.split('/').pop() ?? url,
      cells: {
        name: url.split('/').pop() ?? url,
        type: A.FifoQueue === 'true' ? 'FIFO' : 'Standard',
        messages: A.ApproximateNumberOfMessages != null ? Number(A.ApproximateNumberOfMessages) : null,
        inFlight: A.ApproximateNumberOfMessagesNotVisible != null ? Number(A.ApproximateNumberOfMessagesNotVisible) : null,
        delayed: A.ApproximateNumberOfMessagesDelayed != null ? Number(A.ApproximateNumberOfMessagesDelayed) : null
      }
    }
  })

  return {
    columns: [
      { key: 'name', label: 'Queue', primary: true },
      { key: 'type', label: 'Type' },
      { key: 'messages', label: 'Messages', kind: 'number', align: 'right' },
      { key: 'inFlight', label: 'In flight', kind: 'number', align: 'right' },
      { key: 'delayed', label: 'Delayed', kind: 'number', align: 'right' }
    ],
    rows,
    truncated
  }
}

function queueMetrics(name: string): MetricSpecDTO[] {
  const d = [{ name: 'QueueName', value: name }]
  return [
    { label: 'Messages Visible', namespace: 'AWS/SQS', metricName: 'ApproximateNumberOfMessagesVisible', stat: 'Average', unit: 'Count', dimensions: d },
    { label: 'Messages Sent', namespace: 'AWS/SQS', metricName: 'NumberOfMessagesSent', stat: 'Sum', unit: 'Count', dimensions: d },
    { label: 'Messages Received', namespace: 'AWS/SQS', metricName: 'NumberOfMessagesReceived', stat: 'Sum', unit: 'Count', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const sqs = getClient(SQSClient, ctx)
  const res = await sqs.send(new GetQueueAttributesCommand({ QueueUrl: id, AttributeNames: ['All'] }))
  const A = res.Attributes ?? {}

  const tagsRes = await settle(sqs.send(new ListQueueTagsCommand({ QueueUrl: id })), undefined)

  return {
    id,
    name: id.split('/').pop() ?? id,
    service: 'sqs',
    type: 'queue',
    region: ctx.region,
    tags: tagsRes?.Tags ?? {},
    metrics: queueMetrics(id.split('/').pop()!),
    sections: [
      section('Queue', [
        field('Name', id.split('/').pop()),
        field('URL', id, 'mono'),
        field('ARN', A.QueueArn, 'arn'),
        field('Type', A.FifoQueue === 'true' ? 'FIFO' : 'Standard'),
        field('Created', A.CreatedTimestamp ? new Date(Number(A.CreatedTimestamp) * 1000).toISOString() : null, 'datetime')
      ]),
      section('Messages', [
        field('Visible', A.ApproximateNumberOfMessages != null ? Number(A.ApproximateNumberOfMessages) : null, 'number'),
        field('In flight', A.ApproximateNumberOfMessagesNotVisible != null ? Number(A.ApproximateNumberOfMessagesNotVisible) : null, 'number'),
        field('Delayed', A.ApproximateNumberOfMessagesDelayed != null ? Number(A.ApproximateNumberOfMessagesDelayed) : null, 'number')
      ]),
      section('Config', [
        field('Visibility timeout', A.VisibilityTimeout != null ? Number(A.VisibilityTimeout) : null, 'number'),
        field('Retention', A.MessageRetentionPeriod != null ? Number(A.MessageRetentionPeriod) : null, 'number'),
        field('Max message size', A.MaximumMessageSize != null ? Number(A.MaximumMessageSize) : null, 'number'),
        field('Delay seconds', A.DelaySeconds != null ? Number(A.DelaySeconds) : null, 'number')
      ]),
      section('Encryption', [
        field('KMS master key', A.KmsMasterKeyId, 'mono'),
        field('SSE enabled', A.SqsManagedSseEnabled)
      ])
    ],
    raw: A
  }
}
