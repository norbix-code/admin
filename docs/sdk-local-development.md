# The Norbix SDK packages in the admin portal

The admin portal uses **`@norbix.ai/react-redux`** (RTK Query hooks over the
typed **`@norbix.ai/ts`** SDK) instead of hand-written API services. Since
2026-10-03 both come **from npm** (`package.json` has version ranges), so a
fresh clone, a worktree and CI all build without the sibling `../sdks`
checkouts.

## Using a new SDK version

When an SDK release adds what the portal needs:

```bash
npm install @norbix.ai/ts@^<version> @norbix.ai/react-redux@^<version>
npm run typecheck && npm test && npm run build
```

Commit `package.json` and `package-lock.json` together.

## Trying an SDK change before it is published

Folder layout this assumes:

```
norbix/
  admin/                 ← this app
  sdks/
    norbix-react-redux/  ← @norbix.ai/react-redux
    norbix-js/           ← @norbix.ai/ts
```

Pack the changed SDK(s) and install the tarballs **without saving** them:

```bash
(cd ../sdks/norbix-js && npm run build && npm pack --pack-destination /tmp)
(cd ../sdks/norbix-react-redux && npm run build && npm pack --pack-destination /tmp)
npm install --no-save /tmp/norbix.ai-ts-*.tgz /tmp/norbix.ai-react-redux-*.tgz
npm run dev
```

Repeat the pack + install after each SDK edit. `npm ci` puts the published
versions back. Never commit a `file:` or tarball dependency — CI has no
`../sdks`, and that is what kept `main` red until 2026-10-03.

The order of a change that touches both: merge the SDK pull request, wait for
its release on npm, then raise the version range here.

(The legacy Vite dev server, `npm run _vite:dev:link`, still resolves both
packages to their `../sdks` TypeScript source when `NORBIX_LINK=1`.)

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
   it in `hooks/index.ts`. Try it in the portal with the pack + install above.
3. Release the SDK(s), then raise the version range here (see above).

> The **Admin-Portal public endpoints** (`GET /public/projects/{id}/config` and
> `.../legal/{kind}`) already ship as `norbix.api.public.config(...)` /
> `.legal(...)`, surfaced as the `useGetPublicProjectConfigQuery` /
> `useGetPublicProjectLegalQuery` hooks. They use the `unauthenticated` transport
> scope (no bearer token) since they run before sign-in.

## What the portal still owns (not in the SDK yet)

The SDK covers **login, logout, profile (getUser/updateUser), preferences
(getUserPreferences/updateUserPreferences)**, plus passkeys / magic links /
recovery codes / email verification.

It does **not** yet expose password change/reset, 2FA (TOTP), or
compliance (data export / account deletion). Those screens use a small
app-owned service (`src/services/authService.ts`, `complianceService.ts`)
**temporarily**. The plan is to add these to `@norbix.ai/ts` first; once they
exist, delete those services and switch the screens to SDK hooks — try it
locally with the pack + install above before the SDK release.
