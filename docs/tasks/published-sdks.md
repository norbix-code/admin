# Admin uses the published SDK packages (tracker step 29b)

## Goal

Admin builds from the published `@norbix.ai/ts` and `@norbix.ai/react-redux`
packages instead of the sibling `../sdks` checkouts, so `main` CI (which has no
`../sdks`) is green: lint, format, typecheck, test, build, audit.

Not in scope: new features, the format debt in other repos, the Docker image
workflows (they build from this folder only and get the same fix for free).

## Plan

1. done — react-redux: lock and dev dependency on `@norbix.ai/ts` 4.4.0, drop
   the three campaign-message hooks the SDK removed (react-redux
   `fix/lock-norbix-ts`), so its Release job can publish 1.4.0 with the AI hooks.
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
7. todo — after react-redux 1.4.0 is on npm: `npm install` against the
   registry, run every CI step, commit, PR.

## Changes

| file | what changed | plan step |
|---|---|---|
| `package.json`, `package-lock.json` | published SDK versions | 2, 7 |
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

## Rejected / moved out

- (none)

## Needs you

- [ ] Commit, push and merge the react-redux fix (command in the chat).
- [ ] Tell me when `@norbix.ai/react-redux` 1.4.0 is on npm.

## Open questions

- (none)
