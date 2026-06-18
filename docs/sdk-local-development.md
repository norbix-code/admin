# Developing against @norbix/react-redux locally

The admin portal uses **`@norbix/react-redux`** (RTK Query hooks over the typed
**`@norbix.ai/ts`** SDK) instead of hand-written API services. This doc explains
how to develop the lib and the portal together with an instant feedback loop —
no publish, no version bump, no reinstall.

## The problem we avoid

Without local linking, every lib change is a painful cycle:

1. change the portal, realize the lib needs a change
2. change `@norbix/react-redux`
3. `npm publish` it
4. bump + `npm install` the new version in admin
5. finally use the new functionality

## The loop we have instead

```
edit norbix-react-redux/src/*.ts   →   admin hot-reloads instantly
```

When you're happy, you publish the lib **once**, and other consumers install it
normally. The portal keeps working because in production it uses the published
package — the local link is dev-only.

## Expected folder layout

The link assumes the sibling monorepo checkout:

```
norbix/
  admin/                 ← this app
  sdks/
    norbix-react-redux/  ← the RTK lib (@norbix/react-redux)
    norbix-js/           ← the core SDK (published as @norbix.ai/ts)
```

## How it's wired (neither package is on npm yet)

`@norbix/react-redux` and `@norbix.ai/ts` are **not published yet**, so the
portal consumes them from the local checkouts. Two pieces make that work:

1. **`package.json` uses `file:` deps**, so `npm install` resolves them from
   disk (no npm 404):

   ```jsonc
   "@norbix.ai/ts": "file:../sdks/norbix-js",
   "@norbix/react-redux": "file:../sdks/norbix-react-redux"
   ```

2. **`vite.config.ts` always aliases the lib to its TypeScript source**
   (the lib ships no built `dist/`), and `tsconfig.app.json` has matching
   `paths`. So both Vite and `tsc` resolve:

   | import | resolves to |
   | --- | --- |
   | `@norbix/react-redux` | `../sdks/norbix-react-redux/src/index.ts` (always) |
   | `norbix` (lib's internal import) | `../sdks/norbix-js/src/index.ts` |
   | `@norbix.ai/ts` | `../sdks/norbix-js/src/index.ts` |

   Both the lib and the core SDK resolve to **source** for type-checking, so a
   new SDK endpoint type-checks in the portal **without** first rebuilding the
   SDK's `dist/`. (Vite's runtime alias still follows `NORBIX_LINK` for the core
   SDK — see `dev:link` below — but `tsc` always sees source.)

Because the lib resolves to **source**, editing `norbix-react-redux/src/*.ts`
hot-reloads the portal instantly — no `tsup` build, no publish, no reinstall.

```bash
npm install      # installs the file: deps from the sibling checkouts
npm run dev      # http://localhost:3100 — lib already resolves from source
npm run dev:link # ALSO resolve the core SDK (@norbix.ai/ts) from source,
                 # for when you're editing norbix-js too (sets NORBIX_LINK=1)
```

> The core SDK (`@norbix.ai/ts`) has a built `dist/`, so the **runtime** `file:`
> install works without `dev:link`. But a `dist/` that predates an SDK change is
> stale — so after editing `norbix-js` (or syncing its DTOs), rebuild it once:
>
> ```bash
> cd ../sdks/norbix-js && npm run build   # refreshes dist/ for the non-link path
> ```
>
> `dev:link` (and the `tsc` source paths above) let you skip this while
> developing; the rebuild matters for the default `npm run dev` / `npm run build`.

## Refreshing the SDK DTOs after an API change

The SDK's request/response types live in `norbix-js/src/types/{api2,hub2}.dtos.ts`.
They are generated from the running API's `/metadata` (DEBUG only). When the
gateway adds or changes an endpoint:

1. Regenerate (from a checkout that can reach the API in DEBUG):

   ```bash
   x typescript ./src/types/api2.dtos.ts
   x typescript ./src/types/hub2.dtos.ts
   node scripts/fix-dto-types.mjs
   ```

   Keep the SDK's **mutable** alias block (`IReadOnlyList<T> = T[]`, etc.) and
   the `// @ts-nocheck` header — the wire format is JSON, so arrays stay
   mutable on the client (see Cloud's `src/types/README.md` and `CLAUDE.md`).
2. If the endpoint needs a typed hook in the portal, add a small SDK module
   (e.g. `norbix-js/src/api/<group>.ts`, wired in `src/api/index.ts`) and a
   matching RTK hook factory in `norbix-react-redux/src/hooks/...`, then spread
   it in `hooks/index.ts`. The portal picks it up from source immediately.
3. `cd ../sdks/norbix-js && npm run build` to refresh `dist/` for the
   non-link runtime path.

> The **Admin-Portal public endpoints** (`GET /public/projects/{id}/config` and
> `.../legal/{kind}`) already ship as `norbix.api.public.config(...)` /
> `.legal(...)`, surfaced as the `useGetPublicProjectConfigQuery` /
> `useGetPublicProjectLegalQuery` hooks. They use the `unauthenticated` transport
> scope (no bearer token) since they run before sign-in.

## When the packages are published to npm

Once `@norbix/react-redux` (and `@norbix.ai/ts`) are on npm:

1. In `../sdks/norbix-react-redux`: `npm run build && npm test`, then publish
   (the repo's semantic-release pipeline handles versioning). Publishing also
   produces the `dist/` the package's `main`/`types` point at.
2. In this repo, swap the `file:` deps for version ranges, e.g.
   `"@norbix/react-redux": "^0.1.0"`, and remove the always-on lib alias /
   tsconfig path (keep `dev:link` if you still want source linking on demand).
3. `npm install` — the portal now uses the published artifacts. Nothing in the
   portal's own code changes; it only ever imported `@norbix/react-redux`.

## What the portal still owns (not in the SDK yet)

The SDK covers **login, logout, profile (getUser/updateUser), preferences
(getUserPreferences/updateUserPreferences)**, plus passkeys / magic links /
recovery codes / email verification.

It does **not** yet expose password change/reset, 2FA (TOTP), or
compliance (data export / account deletion). Those screens use a small
app-owned service (`src/services/authService.ts`, `complianceService.ts`)
**temporarily**. The plan is to add these to `@norbix.ai/ts` first; once they
exist, delete those services and switch the screens to SDK hooks — with the
local link, you'll see it working in the portal immediately.
