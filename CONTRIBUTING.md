# Contributing to CloudGaze

Thanks for helping make CloudGaze better! The project is intentionally designed so the most common contribution — **adding support for a new AWS service** — is a single small file with no UI work.

## Principles

1. **Read-only, always.** CloudGaze must never mutate AWS. Only `Describe*` / `List*` / `Get*` calls. Never fetch secret material (Secrets Manager values, SSM `SecureString` values, etc.).
2. **Local & private.** Credentials come from the user's machine and are never persisted by the app or sent anywhere.
3. **Generic over bespoke.** Resources are described with the shared display shapes (`ResourceListResult` / `ResourceDetailResult`) so the renderer stays service-agnostic.
4. **Resilient.** A service the user lacks permission for should return empty / surface its error, never crash a page.

## Dev setup

```bash
npm install
npm run dev        # hot-reloading app
npm run typecheck  # tsc for main + renderer
```

## Adding a service (the one-file path)

Say you want to add **SNS subscriptions**. Three edits:

### 1. Register metadata — `src/shared/services.ts`

```ts
{ id: 'sns-subscriptions', label: 'SNS Subscriptions', icon: 'BellDot',
  category: 'Integration', scope: 'regional', noun: 'subscriptions',
  description: 'Confirmed subscriptions across all topics.' }
```

`icon` is any [lucide-react](https://lucide.dev/icons) name (it falls back to a circle if unknown).

### 2. Implement the lister — `src/main/services/resources/sns-subscriptions.ts`

A module exports exactly two functions:

```ts
export async function list(ctx: AwsCtx): Promise<ResourceListResult>
export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult>
```

Use the helpers in [`resources/util.ts`](src/main/services/resources/util.ts) — `getClient`, `paginate`, `tagsToRecord`, `stateTone`, `field`, `section`, `settle`, `mapLimit` — and copy the closest existing module ([`ec2.ts`](src/main/services/resources/ec2.ts) for a metric-rich resource, [`s3.ts`](src/main/services/resources/s3.ts) for a global one) as your template.

Each list **row** is `{ id, name?, cells, tones?, tags? }`; each **column** declares a `kind` (`mono`/`bytes`/`datetime`/`ago`/`badge`/`bool`/…) that the renderer formats. `detail` returns grouped `sections`, `tags`, optional CloudWatch `metrics` (`MetricSpecDTO[]`), optional `related` resources, and the full `raw` response.

### 3. Wire it into the registry — `src/main/services/resources/index.ts`

```ts
import * as snsSubscriptions from './sns-subscriptions'
// …
export const REGISTRY = {
  // …
  'sns-subscriptions': snsSubscriptions
}
```

That's it. The sidebar, Overview inventory count, list table (with search/sort/pagination), detail drawer, tags, raw-JSON view, and metric charts all light up automatically. No renderer changes.

## Code style

- TypeScript strict; no unused imports/vars (CI runs `tsc`).
- Match the surrounding style — a one-line `/** … */` purpose comment atop each module, `import type` for type-only imports.
- Keep listers cheap: `paginate(..., cap)` and `mapLimit` keep wide accounts civil.

## Pull requests

Run `npm run typecheck` before opening a PR, and describe which AWS APIs your change calls (so reviewers can confirm they're all read-only). Thank you! 💙
