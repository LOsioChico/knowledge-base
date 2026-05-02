# Upstream contribution backlog

Gaps surfaced during the source-verification audit pass on `content/nestjs/*`. Each item lists where I'd file the issue/PR and the evidence I have today. Re-verify against current `master` before opening anything: NestJS moves fast and any of these may already be fixed in a release I haven't checked.

## High confidence

### 1. `PaymentRequiredException` (HTTP 402) missing from `@nestjs/common`

- Repo: [`nestjs/nest`](https://github.com/nestjs/nest)
- Evidence (verified against `nestjs/nest@52030c9`):
  - The HTTP-status enum already lists 402: [`packages/common/enums/http-status.enum.ts#L28`](https://github.com/nestjs/nest/blob/52030c9f4fbceadaf1f20011831ae8a10faee75c/packages/common/enums/http-status.enum.ts#L28) declares `PAYMENT_REQUIRED = 402`.
  - But there is no class to throw. [`packages/common/exceptions/`](https://github.com/nestjs/nest/tree/52030c9f4fbceadaf1f20011831ae8a10faee75c/packages/common/exceptions) is missing a `payment-required.exception.ts` file, and the [barrel `index.ts` (23 lines)](https://github.com/nestjs/nest/blob/52030c9f4fbceadaf1f20011831ae8a10faee75c/packages/common/exceptions/index.ts) exports 22 sibling exceptions but skips 402.
  - Coverage of other 4xx is otherwise complete: 400 `BadRequest`, 401 `Unauthorized`, 403 `Forbidden`, 404 `NotFound`, 405 `MethodNotAllowed`, 406 `NotAcceptable`, 408 `RequestTimeout`, 409 `Conflict`, 410 `Gone`, 412 `PreconditionFailed`, 413 `PayloadTooLarge`, 415 `UnsupportedMediaType`, 418 `ImATeapot`, 421 `Misdirected`, 422 `UnprocessableEntity`. 402 is the only gap in the 400–422 range.
  - User impact: anyone implementing a paywall/quota wall has to write `throw new HttpException('Payment required', HttpStatus.PAYMENT_REQUIRED)` instead of the symmetric `throw new PaymentRequiredException('...')`.
- Action: small PR adding `payment-required.exception.ts` (mirror `im-a-teapot.exception.ts` as the template) and the corresponding `export * from './payment-required.exception';` line to the barrel.

### 2. `nest new --package-manager` doesn't accept `bun`

- Repo: [`nestjs/nest-cli`](https://github.com/nestjs/nest-cli)
- Evidence (verified against `nestjs/nest-cli@cabbe0b`):
  - The `PackageManager` enum has only three values: [`lib/package-managers/package-manager.ts`](https://github.com/nestjs/nest-cli/blob/cabbe0b0caa652b04bc172c26a31a3c40d6b1bd3/lib/package-managers/package-manager.ts):
    ```typescript
    export enum PackageManager {
      NPM = 'npm',
      YARN = 'yarn',
      PNPM = 'pnpm',
    }
    ```
  - The factory throws on anything else: [`lib/package-managers/package-manager.factory.ts#L18`](https://github.com/nestjs/nest-cli/blob/cabbe0b0caa652b04bc172c26a31a3c40d6b1bd3/lib/package-managers/package-manager.factory.ts#L18) → `throw new Error(`Package manager ${name} is not managed.`)`.
  - Auto-detection at [`lib/package-managers/package-manager.factory.ts:22-43`](https://github.com/nestjs/nest-cli/blob/cabbe0b0caa652b04bc172c26a31a3c40d6b1bd3/lib/package-managers/package-manager.factory.ts#L22-L43) only checks for `yarn.lock` and `pnpm-lock.yaml`; a `bun.lockb` is invisible.
  - Bun ships a Node-compatible runtime and is widely adopted; lack of first-class CLI support means users have to scaffold with npm and re-install with bun (losing the lockfile).
- Action: add a `BUN = 'bun'` entry, a `BunPackageManager` mirroring `NpmPackageManager` (Bun's `add` / `remove` / `run` commands match npm's surface), wire it into the factory, and extend auto-detection to include `bun.lockb`. Likely ≈ 80 LoC PR plus tests.

### 3. Schematic schema `default: true` for `flat` is unreachable from the CLI

- Repo: [`nestjs/schematics`](https://github.com/nestjs/schematics) (schema fix) or [`nestjs/nest-cli`](https://github.com/nestjs/nest-cli) (override fix)
- Evidence (verified against `nestjs/schematics@33963b6` and `nestjs/nest-cli@cabbe0b`):
  - Schemas declare `"flat": { "type": "boolean", "default": true }` at line 29 of:
    - [`src/lib/guard/schema.json#L29`](https://github.com/nestjs/schematics/blob/33963b6aa41be01b728db078c44c2ec606272d28/src/lib/guard/schema.json#L29)
    - [`src/lib/pipe/schema.json#L29`](https://github.com/nestjs/schematics/blob/33963b6aa41be01b728db078c44c2ec606272d28/src/lib/pipe/schema.json#L29)
    - [`src/lib/interceptor/schema.json#L29`](https://github.com/nestjs/schematics/blob/33963b6aa41be01b728db078c44c2ec606272d28/src/lib/interceptor/schema.json#L29)
    - [`src/lib/filter/schema.json#L29`](https://github.com/nestjs/schematics/blob/33963b6aa41be01b728db078c44c2ec606272d28/src/lib/filter/schema.json#L29)
    - [`src/lib/middleware/schema.json#L29`](https://github.com/nestjs/schematics/blob/33963b6aa41be01b728db078c44c2ec606272d28/src/lib/middleware/schema.json#L29)
  - CLI behavior contradicts that. On a fresh `nest new`:
    ```
    $ nest g guard auth --dry-run
    CREATE src/auth/auth.guard.ts        # folder-wrapped, i.e. flat=false
    $ nest g guard auth --flat --dry-run
    CREATE src/auth.guard.ts             # flat
    ```
  - Cause:
    - [`actions/generate.action.ts#L40`](https://github.com/nestjs/nest-cli/blob/cabbe0b0caa652b04bc172c26a31a3c40d6b1bd3/actions/generate.action.ts#L40) reads `--flat` from CLI inputs.
    - [`actions/generate.action.ts#L59`](https://github.com/nestjs/nest-cli/blob/cabbe0b0caa652b04bc172c26a31a3c40d6b1bd3/actions/generate.action.ts#L59) coerces it: `const flatValue = !!flat?.value;` — when the flag is absent, `flat?.value` is `undefined` and `flatValue` becomes `false`.
    - [`actions/generate.action.ts#L69`](https://github.com/nestjs/nest-cli/blob/cabbe0b0caa652b04bc172c26a31a3c40d6b1bd3/actions/generate.action.ts#L69) calls `shouldGenerateFlat(configuration, appName, flatValue)`.
    - [`lib/utils/project-utils.ts#L74-L90`](https://github.com/nestjs/nest-cli/blob/cabbe0b0caa652b04bc172c26a31a3c40d6b1bd3/lib/utils/project-utils.ts#L74-L90) returns `false` when neither `--flat` (`flatValue === true`) nor `nest-cli.json`'s `generateOptions.flat` is set.
    - [`actions/generate.action.ts#L135`](https://github.com/nestjs/nest-cli/blob/cabbe0b0caa652b04bc172c26a31a3c40d6b1bd3/actions/generate.action.ts#L135) then unconditionally pushes the resolved value: `schematicOptions.push(new SchematicOption('flat', generateFlat));`. The schematic's own default is shadowed and never reachable through the CLI path.
  - Impact: anything that consumes the schema directly (IDE plugins, third-party schematic runners, docs generated from `schema.json`) gets `flat: true`; the CLI gives `flat: false`. Same schematic, two different defaults depending on entrypoint.
- Action: pick one source of truth. Either (a) change the schema defaults to `false` so they match the CLI's policy, or (b) drop the unconditional override in `generate.action.ts` so the schema default wins when no flag is passed.

## Medium confidence (re-verify before opening)

### 4. Keyv wire format under-documented for `@nestjs/cache-manager` users

- Repo: [`nestjs/docs.nestjs.com`](https://github.com/nestjs/docs.nestjs.com) (primary), with optional companion PR to [`jaredwray/keyv`](https://github.com/jaredwray/keyv)
- Evidence (verified against `jaredwray/keyv@84051be`):
  - Keyv wraps every stored value before sending it to the underlying adapter. From [`core/keyv/src/keyv.ts#L597`](https://github.com/jaredwray/keyv/blob/84051be61cd74d7eee17e0d3d191839816d064b8/core/keyv/src/keyv.ts#L597):
    ```typescript
    const formattedValue = { value: data.value, expires };
    // ...
    encodedValue = await this.encode(formattedValue);
    result = await this._store.set(data.key, encodedValue, data.ttl);
    ```
    `encode` defaults to `JSON.stringify`, so a Redis adapter writes the literal string `{"value":"hello","expires":1730000000000}`.
  - Reading back through the `cache-manager` / Keyv API hides the wrapper, but `redis-cli GET <key>` (or any external consumer that bypasses Keyv) returns the wrapped JSON. Anyone who wrote tooling against `@nestjs/cache-manager` v2 (where the value was stored bare) hits this on upgrade.
  - Verified against `jaredwray/cache-manager@46c31cc`: the wrapped shape only surfaces in `cache-manager` itself when calling `wrap(..., { raw: true })` ([`packages/cache-manager/src/index.ts#L369`](https://github.com/jaredwray/cache-manager/blob/46c31cccee3202078c538463cda343b80801f06e/packages/cache-manager/src/index.ts#L369)). The on-the-wire format is owned by Keyv, not cache-manager.
  - The [official Nest migration guide cache section](https://docs.nestjs.com/migration-guide#cache-module) mentions Keyv but doesn't show the on-the-wire shape.
- Action: doc PR to `docs.nestjs.com` adding a one-liner under the cache-module migration section with a `redis-cli GET` example and the `{ value, expires }` shape, plus a sentence on the migration path (flush vs one-off transform).

### 5. `@nestjs/throttler` `blockDuration` default not in README

- Repo: [`nestjs/throttler`](https://github.com/nestjs/throttler)
- Evidence (verified against `nestjs/throttler@a690419`):
  - The guard resolves `blockDuration` with a fallback to `ttl`: [`src/throttler.guard.ts#L122-L125`](https://github.com/nestjs/throttler/blob/a690419d3e41b665a3288322c52c37f03d35d371/src/throttler.guard.ts#L122-L125):
    ```typescript
    const blockDuration = await this.resolveValue(
      context,
      routeOrClassBlockDuration || namedThrottler.blockDuration || ttl,
    );
    ```
  - The README's options table lists the field but doesn't state this default — [`README.md#L313-L315`](https://github.com/nestjs/throttler/blob/a690419d3e41b665a3288322c52c37f03d35d371/README.md#L313-L315):
    ```html
    <td><code>blockDuration</code></td>
    <td>the number of milliseconds the request will be blocked</td>
    ```
  - Reader has to source-dive to discover that omitting `blockDuration` ties the block window to `ttl`. Common case where they're not the same: `ttl=60000` (1 min sliding window) but you want `blockDuration=300000` (5-minute lockout after limit hit).
- Action: small README PR appending `(default: <code>ttl</code>)` to the `blockDuration` description cell.

### 6. Nest cache-manager docs say `get()` returns `null`; v7 returns `undefined`

- Repo: [`nestjs/docs.nestjs.com`](https://github.com/nestjs/docs.nestjs.com)
- Evidence:
  - [Cache docs](https://docs.nestjs.com/techniques/caching) state: *"If the item does not exist in the cache, `null` will be returned."*
  - cache-manager broke that contract in v7: [`jaredwray/cacheable@ea37202`](https://github.com/jaredwray/cacheable/commit/ea37202931e255b0dfd2f62d7121c84671b1f4fd) ([PR #1134](https://github.com/jaredwray/cacheable/pull/1134), Jun 2025) "BREAKING: moving to undefined instead of null". The `Cache` type signature is now `get<T>(key: string): Promise<T | undefined>` and every `null` return path was rewritten to `undefined` (verified in source + tests changed from `toBeNull()` to `toBeUndefined()`).
  - `@nestjs/cache-manager@3.1.2` declares `peerDependencies.cache-manager: ">=6"` ([`package.json`](https://github.com/nestjs/cache-manager/blob/b37d3b43dd9f15d3237d70a89dd26f5dd2cc8cf2/package.json)), so a fresh install today resolves cache-manager v7.x and the docs are wrong for any user who installed after Jun 2025.
  - The `CACHE_MANAGER` provider is the upstream cache-manager instance with no Nest-side wrapper ([`lib/cache.providers.ts`](https://github.com/nestjs/cache-manager/blob/b37d3b43dd9f15d3237d70a89dd26f5dd2cc8cf2/lib/cache.providers.ts) calls `createCache(...)` directly), so there's no normalization layer that would re-introduce `null`.
- Action: doc PR replacing the `null` claim with a version-aware sentence (`undefined` in v7+, `null` in v6, treat both as falsy).

## Out of scope (mentioned for completeness)

### 7. UUID v7 in Node's `crypto`

- Not a NestJS concern. Node's `crypto.randomUUID()` is RFC 4122 v4 only. v7 (time-ordered) is an active topic in [`nodejs/node`](https://github.com/nodejs/node) issues but I have not verified the current state. Skip unless you specifically want to push it forward.

## Workflow

1. Pick one. Re-grep the upstream `master` branch first: any of items 1–6 may already be fixed in a release I haven't checked.
2. Open as an issue first (not a PR) for items 1, 2, 3 — they're API/behavior decisions the maintainers should weigh in on.
3. Items 4, 5, 6 are pure docs/README edits; PRs are fine without an issue.
4. Cite the source-file path + line in the issue body so maintainers can verify in one click.
