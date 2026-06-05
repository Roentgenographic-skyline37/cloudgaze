/** ACM certificates — list + detail with validity, domains and usage. */
import {
  ACMClient,
  ListCertificatesCommand,
  DescribeCertificateCommand,
  ListTagsForCertificateCommand
} from '@aws-sdk/client-acm'
import type { CertificateSummary } from '@aws-sdk/client-acm'
import { getClient } from '../aws'
import { field, join, paginate, section, settle, stateTone, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const acm = getClient(ACMClient, ctx)
  const { items, truncated } = await paginate<CertificateSummary>(async (token) => {
    const res = await acm.send(new ListCertificatesCommand({ NextToken: token }))
    return { items: res.CertificateSummaryList ?? [], next: res.NextToken }
  })

  const rows = items.map((c) => ({
    id: c.CertificateArn ?? '',
    name: c.DomainName ?? '',
    tones: { status: stateTone(c.Status) },
    cells: {
      domain: c.DomainName ?? '',
      status: c.Status ?? '',
      type: c.Type ?? '',
      notAfter: c.NotAfter ? new Date(c.NotAfter).toISOString() : null,
      inUse: c.InUse ?? null,
      keyAlgorithm: c.KeyAlgorithm ?? ''
    }
  }))

  return {
    columns: [
      { key: 'domain', label: 'Domain', primary: true },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'type', label: 'Type' },
      { key: 'notAfter', label: 'Expires', kind: 'datetime', align: 'right' },
      { key: 'inUse', label: 'In use', kind: 'bool' },
      { key: 'keyAlgorithm', label: 'Key algorithm' }
    ],
    rows,
    truncated
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const acm = getClient(ACMClient, ctx)
  const res = await acm.send(new DescribeCertificateCommand({ CertificateArn: id }))
  const c = res.Certificate

  const tagsRes = await settle(acm.send(new ListTagsForCertificateCommand({ CertificateArn: id })), undefined)

  return {
    id,
    name: c?.DomainName ?? id,
    service: 'acm',
    type: 'certificate',
    region: ctx.region,
    status: c?.Status,
    statusTone: stateTone(c?.Status),
    tags: tagsToRecord(tagsRes?.Tags),
    sections: [
      section('Certificate', [
        field('Domain', c?.DomainName),
        field('Status', c?.Status, 'badge', { tone: stateTone(c?.Status) }),
        field('Type', c?.Type),
        field('ARN', c?.CertificateArn, 'arn'),
        field('Issuer', c?.Issuer),
        field('Key algorithm', c?.KeyAlgorithm)
      ]),
      section('Validity', [
        field('Not before', c?.NotBefore ? new Date(c.NotBefore).toISOString() : null, 'datetime'),
        field('Not after', c?.NotAfter ? new Date(c.NotAfter).toISOString() : null, 'datetime'),
        field('Issued', c?.IssuedAt ? new Date(c.IssuedAt).toISOString() : null, 'datetime')
      ]),
      section('Domains', [field('Subject alternative names', join(c?.SubjectAlternativeNames ?? [], ', '))]),
      section('Usage', [
        field('In use by', c?.InUseBy?.length ?? null, 'number'),
        field('Renewal eligibility', c?.RenewalEligibility)
      ])
    ],
    raw: c
  }
}
