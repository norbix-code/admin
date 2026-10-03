# Admin uses the published SDK packages (tracker step 29b)
This file: /Users/djovaisas/Projects/norbix/worktrees/admin/ci/published-sdks/docs/tasks/published-sdks.md (branch ci/published-sdks)

## Goal

Admin builds from the published `@norbix.ai/ts` and `@norbix.ai/react-redux`
packages instead of the sibling `../sdks` checkouts, so `main` CI (which has no
`../sdks`) is green: lint, format, typecheck, test, build, audit.

Not in scope: new features, the format debt in other repos, the Docker image
workflows (they build from this folder only and get the same fix for free).

## Plan

1. done — react-redux: lock and dev dependency on `@norbix.ai/ts` 4.4.0, drop
   the three campaign-message hooks the SDK removed, so its Release job can
   publish the AI hooks — merged (rebase) as
   https://github.com/norbix-code/react-redux/pull/34, released as
   `@norbix.ai/react-redux` 1.4.0; react-redux `main` CI, CodeQL and Release green.
2. done — `package.json`: `file:../sdks/…` → `"@norbix.ai/ts": "^4.4.0"`,
   `"@norbix.ai/react-redux": "^1.4.0"`; the old name `@norbix/react-redux`
   is gone (it was never on npm; the package is published as
   `@norbix.ai/react-redux`).
3. done — imports and comments: `@norbix/react-redux` → `@norbix.ai/react-redux`.
4. done — `tsconfig.json`, `tsconfig.app.json`: remove the `../sdks` source
   paths. `next.config.mjs`: remove `transpilePackages` and the `.js` →
   `.ts` extension alias (both only existed for SDK source).
5. done — `vite.config.ts` (legacy `_vite:*` scripts): source linking only on
   demand (`NORBIX_LINK=1`), for both packages.
6. done — docs: `README.md`, `docs/sdk-local-development.md` (published
   packages by default; how to try an unpublished SDK change locally),
   `docs/agreements.md`, `docs/implementation-plan.md`.
7. done — lock from the npm registry (`@norbix.ai/react-redux` 1.4.0,
   `@norbix.ai/ts` 4.4.0); the stale extraneous `../sdks/norbix-react-redux`
   lock entry removed. Every CI step green locally: `npm ci`, lint, format
   check, typecheck, test (80 passed), build, production audit. Shipped with
   `nbx-ship` (squash).

## Changes

| file | what changed | plan step |
|---|---|---|
| `package.json`, `package-lock.json` | published SDK versions; stale `../sdks` lock entry removed | 2, 7 |
| `src/App.tsx`, `src/services/norbix.ts`, `src/app/store.ts` | package name | 3 |
| `tsconfig.json`, `tsconfig.app.json`, `next.config.mjs` | no `../sdks` wiring | 4 |
| `vite.config.ts` | source linking on demand only | 5 |
| `README.md`, `docs/sdk-local-development.md`, `docs/agreements.md`, `docs/implementation-plan.md` | published packages | 6 |

## Findings

- `tsconfig.tsbuildinfo` is tracked in git (a build cache). Left open.
- react-redux: `npm run format:check` fails on ~20 files on `main`; its CI does
  not run it. Left open.
- react-redux: Dependabot bumped the `@norbix.ai/ts` dev dependency to
  `^4.2.0`, below the `>=4.3.0` peer range, and broke `main`. A Dependabot
  `ignore` or a grouped rule for `@norbix.ai/*` would stop this. Left open.
- react-redux: no hook yet for `hub.email.getEmailPreferencesByLink`
  (added in `@norbix.ai/ts` 4.3.0). Left open.
- SDK repos (react-redux, sdk-ts, likely all npm SDKs): the CI Security scan
  (OSV) was red on every branch, `main` included, on 12 advisories no update
  can fix — packages bundled inside the npm CLI that semantic-release runs,
  and braces 3.0.3. Fixed in react-redux only, by an `osv-scanner.toml` with
  exact ids, reasons and `ignoreUntil = 2026-11-03` (react-redux pull request
  34, second commit). sdk-ts and the other npm SDKs still need the same file.
  Left open.

## Rejected / moved out

- (none)

## Needs you

- (none)

## Open questions

- (none)
