---
title: SWC builder
aliases:
  [
    "swc",
    "swc setup",
    "swc compiler",
    "nest start swc",
    "fast nest builds",
    "@swc/core nest",
    SWC builder for NestJS,
  ]
tags: [type/recipe, tech/typescript, tech/nest-cli]
area: nestjs
status: evergreen
related:
  - "[[nestjs/recipes/index]]"
  - "[[nestjs/recipes/monorepo]]"
  - "[[nestjs/releases/v10]]"
source:
  - https://docs.nestjs.com/recipes/swc
  - https://swc.rs
  - https://swc.rs/docs/configuration/modules
  - https://github.com/nestjs/nest-cli/blob/master/lib/compiler/defaults/swc-defaults.ts
  - https://github.com/nestjs/nest-cli/blob/master/lib/compiler/swc/swc-compiler.ts
  - https://github.com/nestjs/nest-cli/blob/master/commands/start.command.ts
  - https://github.com/nestjs/schematics/blob/master/src/lib/sub-app/sub-app.factory.ts
  - https://github.com/nestjs/nest-cli/blob/master/lib/configuration/configuration.ts
---

> [SWC](https://swc.rs) is a Rust-based TS/JS compiler that's roughly **20× faster** than `tsc` on Nest builds. The Nest CLI has built-in support since [[nestjs/releases/v10|v10]]: opt in with one flag, then layer `tsc --noEmit` on top for type-checking. This is the default builder for new and existing Nest projects in this knowledge base; reach for `tsc` or `webpack` only when noted.

## Setup

```shell
npm i --save-dev @swc/core @swc/cli
```

That's it. SWC ships with sensible defaults for Nest applications; no `.swcrc` required for the common case. The Nest CLI loads SWC via [`swcDefaultsFactory`](https://github.com/nestjs/nest-cli/blob/master/lib/compiler/defaults/swc-defaults.ts) and invokes the compiler through `@swc/cli` ([`SwcCompiler#loadSwcCliBinary`](https://github.com/nestjs/nest-cli/blob/master/lib/compiler/swc/swc-compiler.ts#L198-L207) does `require('@swc/cli/lib/swc/dir')` and exits with an install hint if either package is missing), so both packages are required for `nest start -b swc`.

## Minimal working example

Run a fresh app with SWC + type-check in dev:

```shell
nest start -b swc --type-check
# Watch mode
nest start -b swc --type-check -w
```

`-b` is the short form of `--builder` and selects the compiler backend. The enum is `tsc | webpack | swc` ([`start.command.ts#L19`](https://github.com/nestjs/nest-cli/blob/master/commands/start.command.ts#L19) declares the option; the action validates against `availableBuilders = ['tsc', 'webpack', 'swc']` at [`start.command.ts#L108-L113`](https://github.com/nestjs/nest-cli/blob/master/commands/start.command.ts#L108-L113)). `-w` is `--watch`. Both flags also accept their long form if you prefer scripts to be self-explanatory.

Make it permanent in `nest-cli.json` (`compilerOptions.builder` accepts the same `'tsc' | 'swc' | 'webpack'` union, optionally as `{ type, options }`; see [`CompilerOptions` in `nest-cli/configuration.ts`](https://github.com/nestjs/nest-cli/blob/master/lib/configuration/configuration.ts)):

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "builder": "swc",
    "typeCheck": true
  }
}
```

After that, `nest start`, `nest start --watch`, and `nest build` all use SWC automatically; you don't need to repeat the flags in `package.json` scripts.

## What `--type-check` actually does

SWC strips and emits TypeScript fast because it does **no type checking**: it doesn't even build a type graph. `--type-check` (or `typeCheck: true`) tells the Nest CLI to run `tsc --noEmit` alongside SWC so type errors still surface in your terminal. In **watch** mode `tsc` is forked into a child process and runs in parallel with `runSwc()` (no `await`). In **non-watch** mode (`nest build`) `runTypeChecker` is awaited before `runSwc`, so the build blocks on type-checking ([`SwcCompiler#run`](https://github.com/nestjs/nest-cli/blob/master/lib/compiler/swc/swc-compiler.ts)).

```shell
# Without --type-check: build is fast, but `const x: string = 1` ships
nest start -b swc

# With --type-check + watch: SWC and tsc run in parallel, tsc errors print asynchronously
nest start -b swc -w --type-check

# With --type-check, no watch: build blocks on tsc before SWC runs
nest start -b swc --type-check
```

> [!warning] Type-check is **mandatory** when CLI Plugins are enabled
> `@nestjs/swagger` and `@nestjs/graphql` plugins read TypeScript type information at build time to generate OpenAPI/GraphQL schemas. The Nest CLI only runs them when `--type-check` (or `typeCheck: true`) is on; without it, the plugin transformer never executes and your generated schema misses operations, while the app itself still boots. Source: [SWC recipe, CLI Plugins](https://docs.nestjs.com/recipes/swc#cli-plugins-swc).

## Choosing a builder

Default to `swc` and only fall back when you hit a known incompatibility or you're inside a CLI [[nestjs/recipes/monorepo|monorepo]] (where the [official SWC monorepo guide](https://docs.nestjs.com/recipes/swc#monorepo) keeps `webpack` and uses [`swc-loader`](#monorepo-use-swc-loader-inside-webpack) instead of the standalone `swc` builder).

| Builder   | Speed      | Type-checks                    | When to use                                                                                                                                                                                                                         |
| --------- | ---------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `swc`     | ~20× `tsc` | No (pair with `--type-check`)  | **Default for single-app projects.** New projects, dev loop, simple builds.                                                                                                                                                         |
| `tsc`     | Baseline   | Yes                            | Fallback when `swc` triggers a known incompatibility (legacy decorator emit edge cases, custom transformers).                                                                                                                       |
| `webpack` | Slow       | Via `ts-loader` / `swc-loader` | **CLI monorepo path**: the [official SWC monorepo guide](https://docs.nestjs.com/recipes/swc#monorepo) uses webpack with [`swc-loader`](#monorepo-use-swc-loader-inside-webpack) to keep SWC's speed. See [[nestjs/recipes/monorepo | monorepo recipe]]. |

## Tests: SWC + Jest

Default Nest projects ship with `ts-jest`. Swap to `@swc/jest` for parity with the build:

```shell
npm i --save-dev @swc/jest
```

```json
// package.json (or jest.config.js)
{
  "jest": {
    "transform": {
      "^.+\\.(t|j)s?$": ["@swc/jest"]
    }
  }
}
```

Then add the legacy-decorator transforms to `.swcrc` so DI metadata is emitted in test builds:

```json
{
  "$schema": "https://swc.rs/schema.json",
  "sourceMaps": true,
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "decorators": true,
      "dynamicImport": true
    },
    "transform": {
      "legacyDecorator": true,
      "decoratorMetadata": true
    },
    "baseUrl": "./"
  },
  "minify": false
}
```

Without `legacyDecorator` + `decoratorMetadata`, `@Injectable`/`@Inject` services lose constructor type metadata and DI resolution fails at runtime with `Nest can't resolve dependencies of ...`.

## Tests: SWC + Vitest

[Vitest](https://vitest.dev) pairs naturally with SWC via [`unplugin-swc`](https://github.com/unplugin/unplugin-swc):

```shell
npm i --save-dev vitest unplugin-swc @swc/core @vitest/coverage-v8
```

```typescript
// vitest.config.ts
import { resolve } from "node:path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: "./",
  },
  plugins: [
    // module: { type: "es6" } overrides any .swcrc that might force commonjs
    swc.vite({ module: { type: "es6" } }),
  ],
  resolve: {
    // Vitest does NOT auto-resolve TS path aliases like "src/*" — declare them
    alias: { src: resolve(__dirname, "./src") },
  },
});
```

E2E config is the same with an `include` filter:

```typescript
// vitest.config.e2e.ts
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.e2e-spec.ts"],
    globals: true,
    root: "./",
  },
  plugins: [swc.vite()],
});
```

```json
// package.json scripts
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "test:e2e": "vitest run --config ./vitest.config.e2e.ts"
  }
}
```

> [!warning] `supertest` import shape differs under Vitest
> Change `import * as request from "supertest"` to `import request from "supertest"` in E2E tests. Vite/Vitest expects a default import; the namespace form silently breaks request chaining. Source: [Vitest path-aliases section](https://docs.nestjs.com/recipes/swc#update-imports-in-e2e-tests).

## Using SWC in a CLI [[nestjs/recipes/monorepo|monorepo]]

The Nest CLI defaults to `webpack` in monorepo mode (the `sub-app` schematic sets [`compilerOptions.webpack = true`](https://github.com/nestjs/schematics/blob/master/src/lib/sub-app/sub-app.factory.ts#L358) when promoting a workspace; the official [SWC recipe → Monorepo](https://docs.nestjs.com/recipes/swc#monorepo) keeps webpack and uses `swc-loader`), so the standalone `swc` builder above is **not** wired in. To get SWC speed in a monorepo, plug `swc-loader` into webpack:

```shell
npm i --save-dev swc-loader
```

```javascript
// webpack.config.js (project root)
const swcDefaultConfig =
  require("@nestjs/cli/lib/compiler/defaults/swc-defaults").swcDefaultsFactory().swcOptions;

module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: { loader: "swc-loader", options: swcDefaultConfig },
      },
    ],
  },
};
```

CLI Plugins don't auto-run under `swc-loader`. If you use `@nestjs/swagger` or `@nestjs/graphql`, see [Monorepo and CLI plugins](https://docs.nestjs.com/recipes/swc#monorepo-and-cli-plugins) for the manual `PluginMetadataGenerator` step.

See also: [[nestjs/recipes/monorepo|NestJS CLI monorepos]] for the surrounding monorepo workflow.

## Gotchas

> [!warning] Circular type imports break with SWC
> SWC saves the type of every decorated property in metadata, so a `@OneToOne(() => Profile)` on `User` plus a `@OneToOne(() => User)` on `Profile` triggers a circular import at runtime under SWC even when `tsc` was happy. Wrap the type to suppress metadata emission:
>
> ```typescript
> import { Entity, OneToOne, Relation } from "typeorm"; // or your own WrapperType<T> = T
> import { Profile } from "./profile.entity";
>
> @Entity()
> export class User {
>   @OneToOne(() => Profile, (profile) => profile.user)
>   profile: Relation<Profile>; // not just `Profile`
> }
> ```
>
> Same fix applies to `forwardRef()` constructor injections: wrap the parameter type in `WrapperType<T>` or your ORM's equivalent. Source: [SWC common pitfalls](https://docs.nestjs.com/recipes/swc#common-pitfalls).

> [!info] CommonJS vs ES modules
> The Nest CLI's SWC integration sets `module.type: "commonjs"` in its built-in defaults (matches `tsc`'s `"module": "commonjs"`). Raw `@swc/core` leaves `module` untouched unless you set it. If you put `"module": { "type": "es6" }` in `.swcrc` for an ESM package, `@swc/jest` and Vitest may inherit that and break. Pin the test `module` explicitly: `swc.vite({ module: { type: "es6" } })` or use a separate `.swcrc` for tests. Source: [`swc-defaults.ts` in `nest-cli`](https://github.com/nestjs/nest-cli/blob/master/lib/compiler/defaults/swc-defaults.ts), [SWC modules docs](https://swc.rs/docs/configuration/modules).

## See also

- [Official SWC recipe](https://docs.nestjs.com/recipes/swc): full reference, including `.swcrc` schema and Vitest path-alias handling
- [SWC documentation](https://swc.rs): config, plugins, benchmarks
- [`@swc/jest`](https://github.com/swc-project/jest): the Jest transformer
- [`unplugin-swc`](https://github.com/unplugin/unplugin-swc): the Vite/Rollup/Webpack plugin used by Vitest
- [TrilonIO/nest-vitest](https://github.com/TrilonIO/nest-vitest): working Vitest + Nest sample
- [[nestjs/releases/v10|NestJS 10 release notes]]: SWC builder shipped here
- [[nestjs/recipes/monorepo|NestJS CLI monorepos]]: where `swc-loader` (not the `swc` builder) applies
