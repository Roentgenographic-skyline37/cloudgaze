/**
 * Generic AWS client factory.
 *
 * Credentials come from the standard AWS credential chain (env vars, then
 * ~/.aws/credentials + ~/.aws/config) via fromNodeProviderChain — so the app
 * "just works" for anyone who has run `aws configure`. No secrets are stored by
 * this app.
 *
 * Unlike a single-deployment dashboard, CloudGaze is account-agnostic: clients
 * are created on demand for any (profile, region, service) and memoized per
 * that triple. Pass a `global: true` to pin a client to the global region for
 * services like IAM / Route 53 / CloudFront / S3-control.
 */
import { fromNodeProviderChain } from '@aws-sdk/credential-providers'
import { APP } from '@shared/config'
import type { AwsCtx } from '@shared/types'

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

type CredProvider = ReturnType<typeof fromNodeProviderChain>

// One credential provider per profile (resolving creds is relatively costly).
const credCache = new Map<string, CredProvider>()

export function credsFor(profile: string): CredProvider {
  const key = profile || 'default'
  let p = credCache.get(key)
  if (!p) {
    // ENV credentials always take precedence inside the chain, so passing a
    // profile name is safe even when the user is really running off env vars.
    p = fromNodeProviderChain({ profile: key })
    credCache.set(key, p)
  }
  return p
}

// One client per (className, profile, region).
const clientCache = new Map<string, unknown>()

// Loosely typed config — every AWS SDK v3 client accepts at least these.
type ClientCtor<T> = new (config: { region: string; credentials: CredProvider }) => T

/**
 * Get (or create + memoize) an AWS SDK v3 client of the given class for this
 * context. Set `global` for account-global services so they always hit the
 * global region regardless of the user's region selection.
 */
export function getClient<T>(Ctor: ClientCtor<T>, ctx: AwsCtx, opts?: { global?: boolean }): T {
  const region = opts?.global ? APP.globalRegion : ctx.region
  const key = `${Ctor.name}:${ctx.profile}:${region}`
  let c = clientCache.get(key) as T | undefined
  if (!c) {
    c = new Ctor({ region, credentials: credsFor(ctx.profile) })
    clientCache.set(key, c)
  }
  return c
}

/** Drop every cached client + credential provider (after creds change). */
export function resetClients(): void {
  clientCache.clear()
  credCache.clear()
}
