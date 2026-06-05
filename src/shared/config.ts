/**
 * Static app configuration. CloudGaze is account-agnostic: there are NO
 * hardcoded accounts, instances, or secrets here. AWS credentials come from
 * the standard credential chain (~/.aws), and the active profile + region are
 * chosen by the user at runtime.
 */
import type { AwsRegion } from './types'

export const APP = {
  name: 'CloudGaze',
  tagline: 'See everything in your AWS account',
  /** Fallback region when a profile has none and the user hasn't picked one. */
  defaultRegion: 'us-east-1',
  /** Region used for global services (IAM, Route 53, CloudFront, S3 control). */
  globalRegion: 'us-east-1',
  /** localStorage keys. */
  storageKeys: {
    profile: 'cg.profile',
    region: 'cg.region',
    theme: 'cg.theme',
    refresh: 'cg.refresh'
  }
} as const

/**
 * Canonical commercial-partition regions (id + human label). Used to populate
 * the region picker without requiring an EC2 DescribeRegions permission. Not
 * every account has every region enabled; calls to a disabled region simply
 * error and surface as empty.
 */
export const AWS_REGIONS: AwsRegion[] = [
  { id: 'us-east-1', label: 'US East (N. Virginia)' },
  { id: 'us-east-2', label: 'US East (Ohio)' },
  { id: 'us-west-1', label: 'US West (N. California)' },
  { id: 'us-west-2', label: 'US West (Oregon)' },
  { id: 'af-south-1', label: 'Africa (Cape Town)' },
  { id: 'ap-east-1', label: 'Asia Pacific (Hong Kong)' },
  { id: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { id: 'ap-south-2', label: 'Asia Pacific (Hyderabad)' },
  { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { id: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { id: 'ap-southeast-3', label: 'Asia Pacific (Jakarta)' },
  { id: 'ap-southeast-4', label: 'Asia Pacific (Melbourne)' },
  { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { id: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { id: 'ap-northeast-3', label: 'Asia Pacific (Osaka)' },
  { id: 'ca-central-1', label: 'Canada (Central)' },
  { id: 'ca-west-1', label: 'Canada West (Calgary)' },
  { id: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { id: 'eu-central-2', label: 'Europe (Zurich)' },
  { id: 'eu-west-1', label: 'Europe (Ireland)' },
  { id: 'eu-west-2', label: 'Europe (London)' },
  { id: 'eu-west-3', label: 'Europe (Paris)' },
  { id: 'eu-north-1', label: 'Europe (Stockholm)' },
  { id: 'eu-south-1', label: 'Europe (Milan)' },
  { id: 'eu-south-2', label: 'Europe (Spain)' },
  { id: 'me-south-1', label: 'Middle East (Bahrain)' },
  { id: 'me-central-1', label: 'Middle East (UAE)' },
  { id: 'il-central-1', label: 'Israel (Tel Aviv)' },
  { id: 'sa-east-1', label: 'South America (São Paulo)' }
]

export function regionLabel(id: string): string {
  return AWS_REGIONS.find((r) => r.id === id)?.label ?? id
}
