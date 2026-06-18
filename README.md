# Norbix Admin Portal

The **Admin Portal** is the out-of-the-box, self-service portal for a Norbix
project's **end users**. When a developer doesn't have time to build their own
user dashboard, this gives their users a ready-made one: sign in, manage
password & 2FA, edit their profile, control marketing preferences, and handle
data-privacy requests. It also hosts the project's public terms & privacy
policy at a stable URL (usable in app-store listings).

It is open source (MIT) and talks **only to the Norbix API gateway** (the
end-user data plane), never to the Hub.

## How a project is selected

One deployment serves many projects. The project id lives in the **subdomain**:

```
pr_{base62}.admin.norbix.ai     →  that project's login screen
admin.norbix.ai                 →  blank placeholder (no project)
```

Point a custom domain at it with a CNAME:

```
admin.yourapp.com  CNAME  pr_7Hk2.admin.norbix.ai
```

See [`docs/`](./docs) for the full architecture, login-config resolution,
features, implementation plan, and devops.

## Develop

```bash
npm install
cp .env.example .env     # set VITE_ADMIN_HUB_BASE_URL etc.
npm run dev              # http://localhost:3100 (uses published SDK packages)
npm run dev:link         # same, but resolves @norbix/react-redux + @norbix.ai/ts
                         # to LOCAL SOURCE for instant lib development (HMR)
npm run build            # tsc -b + vite build
npm run lint             # eslint
npm test                 # vitest
```

Requires Node ≥ 22.12 (Vite 7).

### Data access via the Norbix SDK

The portal uses **`@norbix/react-redux`** (RTK Query hooks over the typed
**`@norbix.ai/ts`** SDK) for data access instead of hand-written services
(`createNorbixApi` + `NorbixProvider`, wired in `src/services/norbix.ts`).
To develop the lib and the portal together with no publish/install cycle, see
[`docs/sdk-local-development.md`](./docs/sdk-local-development.md) and use
`npm run dev:link`.

For local dev without a `pr_` subdomain, pin a project with
`VITE_ADMIN_PROJECT_ID` in `.env`, or add a static config at
`config/projects/{id}.json` and visit with that id.

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
