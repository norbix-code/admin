# Norbix Admin Portal

The **Admin Portal** is the out-of-the-box, self-service portal for a Norbix
project's **end users**. When a developer doesn't have time to build their own
user dashboard, this gives their users a ready-made one: sign in, manage
password & passkeys, edit their profile, and choose which messages they get
(the communication structure the project defines in Cloud). The Privacy & data
page (export / delete) is hidden until the gateway has its endpoints. It also hosts the project's public terms & privacy
policy at a stable URL (usable in app-store listings).

It is open source (MIT) and talks **only to the Norbix API gateway** (the
end-user data plane), never to the Hub.

## How a project is selected

One deployment serves many projects. The project lives in the **host label**
— the gateway's `ProjectId.HostLabel`, `pr-` + the project Guid as 32
lower-case hex digits (DNS-safe: no `_`, one case):

```
pr-4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2.admin.norbix.ai  →  project pr_5R4dlqJeXx943tOzSDEwbS
admin.norbix.ai                                       →  blank placeholder (no project)
```

The portal turns the label back into the `pr_{base62}` id
(`ProjectId.ViewId`) the gateway reads (`src/config/project.ts`). Point a
custom domain at it with a CNAME:

```
admin.yourapp.com  CNAME  pr-4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2.admin.norbix.ai
```

See [`docs/`](./docs) for the full architecture, login-config resolution,
features, implementation plan, and devops.

## Develop

```bash
npm install
cp .env.example .env     # set VITE_ADMIN_HUB_BASE_URL etc.
npm run dev              # http://localhost:3100 (uses the published SDK packages)
npm run build            # next build
npm run typecheck        # tsc
npm run lint             # eslint
npm test                 # vitest
```

Requires Node ≥ 22.12 (Vite 7).

### Data access via the Norbix SDK

The portal uses **`@norbix.ai/react-redux`** (RTK Query hooks over the typed
**`@norbix.ai/ts`** SDK) for data access instead of hand-written services
(`createNorbixApi` + `NorbixProvider`, wired in `src/services/norbix.ts`).
Both come from npm. To try an SDK change before it is published, see
[`docs/sdk-local-development.md`](./docs/sdk-local-development.md).

For local dev without a `pr-<hex>` host, pin a project with
`NEXT_PUBLIC_ADMIN_PROJECT_ID` in `.env` (a Docker image takes it as
`--build-arg NEXT_PUBLIC_ADMIN_PROJECT_ID=pr_…`: Next inlines it at build
time).

## Tech

React 19 · TypeScript 5.9 · Vite 7 (ESM-only, Node ≥ 22.12) · Redux Toolkit
2.12 (+ RTK Query) · React Router 7 · redux-persist · Tailwind CSS 3.

**Minimal by design.** The runtime dependency list is deliberately tiny
(5 packages) to shrink the attack surface and supply-chain risk. Forms use
native React state (no form library) and UI primitives/icons are hand-written
(no component or icon library). Please don't add runtime dependencies without
discussion — see [`SECURITY.md`](./SECURITY.md).

## Endpoint discovery (`/echo`)

The only endpoint you configure is the **Hub URL** (`VITE_ADMIN_HUB_BASE_URL`).
On boot the portal calls the Hub's `GET /{version}/echo`, which returns the
**API URL**, **regions**, **release**, **license**, and MJML URL. The portal
stores that in the `config` slice and the API base query targets the
discovered `apiUrl` at request time. The env `VITE_ADMIN_API_BASE_URL` is only
a fallback used when the Hub is unreachable. This mirrors how the Cloud portal
consumes `/echo`.

## Social sign-in

The sign-in page shows one "Continue with …" button per entry of the public
config's `auth.socialSignIn` (the enabled social sign-in integrations of the
env: `provider`, `displayName`, `startPath`). No entries, no buttons.

1. **Start.** The button sends the browser to
   `{API host}{startPath}&returnUrl={portal}/oauth/callback?via={provider}`.
   The API host is the origin of `apiUrl` from `/echo`, **not** the
   same-origin proxy. The gateway sets a short-lived HttpOnly cookie on that
   host and checks it when the provider calls back, so a start through the
   proxy would put the cookie on the portal host and end in `state_mismatch`.
   `startPath` already carries the project and the env (the portal's SDK
   client knows neither the API host nor the env, so the SDK's
   `socialSignInUrl` is not used for this one URL).
2. **Return.** The gateway sends the browser to `/oauth/callback` with a
   one-time `code` and `provider` (plus `intent=link` for a link), or with
   `error=<reason>`. No token is ever in the URL. The page takes the code
   out of the address bar, exchanges it through the proxy with no
   credentials (`api.auth.exchangeSocialCode`, 2 minutes, once) and stores
   the bearer JWT exactly like a password sign-in.
3. **Link (Security → Sign-in methods).** "Link {provider}" calls
   `api.membership.startLinkIdentity` as the signed-in user and sends the
   browser to the `authorizeUrl` it answers. The return page finishes the
   link (`finishLinkIdentity`) and goes back to Security with "Linked …", or
   "This {provider} account belongs to someone else." (409,
   CM-ERRORS-MEMBERSHIP-055). The page does not list the accounts already
   linked: the API host has no read of a user's other logins.

**The portal's origin must be allowed.** The gateway accepts `returnUrl` only
when it is absolute https (plain http only for `localhost`) and its origin is
in the project's CORS union: the saved Allowed Origins (Cloud → Project →
Settings → Access) plus the origin of every environment admin URL. The hosted
`pr-<hex>.admin.<domain>` host is **not** added by itself; save it (or a
custom domain) as an Allowed Origin or set it as the environment's admin URL.
For local development save `http://localhost:3100`. A refused start
(CM-ERRORS-MEMBERSHIP-052, also 049 / 050 / 053) is a JSON answer on the API
host's page: the browser never comes back to the portal, so the portal cannot
word it.

**At the provider**, register the callback
`{API host}/v3/membership/auth/social/{provider}/callback/{projectId}` with
the same host `/echo` reports. The gateway builds it from the host the request
reached: for sign-in that is the API host itself; for a link start (sent
through the proxy) it is the proxy's `API_BASE_URL`, which must therefore be
the same public API host, not an internal address.

### Passkey recovery link

The gateway's passkey recovery e-mail links to
`{portal}/oauth/callback#token=…` (`MembershipPortalLinks.MagicLink`). The
same page handles it:

- the token is read from the fragment (then the query), taken out of the
  address bar and redeemed once with
  `api.membership.consumeMagicLink({ token })` on a client with **no**
  credentials (a recovering user often still has an old token);
- the answer is a **restricted** recovery session (`amr=MagicLink`, a
  15-minute access token, no refresh in the portal). Only its `accessToken`
  is stored, marked as a recovery; the link token and the refresh token never
  are;
- the user lands on Security with "You signed in with a recovery link": add a
  new passkey (the card asks for the e-mail, which this session cannot read,
  and proves it with the e-mailed code), or set a new password by e-mail
  (`/sign-in/reset`). Change password (needs the current one) and linking
  (needs the login id) are hidden for this session. Adding a passkey ends the
  recovery mark;
- refusals in plain words: expired or used (CM-ERRORS-PASSKEY-016), turned
  off for the project (-015), another environment
  (CM-ERRORS-MEMBERSHIP-USERS-049), too many attempts (429), and a link with
  no token.

The portal leads to a new passkey; it does not lock the other pages (the
gateway does not restrict the session either).

## State management

The store backbone mirrors the Cloud project (`cloud/src/app/store.ts`):
`combineReducers` → `persistReducer` (RTK Query caches blacklisted) → a root
reducer with an `auth/reset` hard-purge → a `createStore` factory wiring the
listener middleware, RTK Query middleware, and `setupListeners`. Adding a new
feature slice follows the same pattern. See [`src/app/store.ts`](./src/app/store.ts).

## Quality & security tooling

- **CI** (`.github/workflows/ci.yml`): lint, format check, typecheck, tests,
  build, and `npm audit` on every PR.
- **CodeQL** static analysis and **Trivy** image scanning.
- **Dependabot** weekly updates for npm, GitHub Actions, and the Docker base.

## Licensing note for contributors

UI components here are **clean-room**: plain React + Tailwind CSS (MIT), no
component library. Do **not** paste markup from Tailwind UI / Catalyst (a paid
product) into this repository. See [`NOTICE`](./NOTICE).
