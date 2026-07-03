# Admin Portal — the backend

The portal is a **Next.js app (app router)** shipped as **one self-hostable
Docker image** — no Vercel. One Node process serves both the React UI and the
server-side route handlers (`app/api/*`). This replaces the old static-only
Vite + nginx image.

## Why a backend (not a pure SPA)

Some data the portal renders is **privileged** and must not be fetchable with an
end user's low-privilege token:

- the project's **roles** catalog (display names),
- the **marketing-preferences structure** (the groups/channels/tags a user opts
  in/out of),
- later: **schema-driven forms** and per-deployment **third-party** integrations.

A browser SPA cannot hold a privileged credential. So a thin server backend holds
a **service-user API key** (scoped read-only) and fetches the catalog server-side.
Forkers extend the portal by adding their own `app/api/*` routes that call their
own services — the reason this is a backend and not just static files.

## What runs where

| Concern | Where | Auth |
| --- | --- | --- |
| Privileged catalog (roles, marketing-pref structure) | **backend** (`/api/bootstrap`) | service-user API key (server env) |
| Brand + auth config | backend (folded into `/api/bootstrap`) | none (public), served once for fewer round-trips |
| Everything else: user data, login, echo | **browser → `/api/proxy/*` → gateway** | the user's JWT (via the SDK) |
| Custom-domain → projectId resolution | browser → managed Hub `/admin-portal-id` | none (id-only) |

The service-user API key **never reaches the browser**. `app/lib/serverNorbix.ts`
imports `server-only`, so the build fails if a client component ever pulls it in.
The reverse proxy (`/api/proxy/*`) forwards only the user's JWT — never the key.

## `/api/bootstrap`

`GET /api/bootstrap?projectId=…` → one trusted server-side call returning:

```jsonc
{
  "projectId": "pr_…",
  "branding": { … } | null,          // public brand
  "auth": { … } | null,              // public auth options
  "roles": [ { "id", "name", "displayName" } ],   // PRIVILEGED
  "marketingPreferences": { … } | null,           // PRIVILEGED structure
  "warnings": ["service-key-missing" | "roles-unavailable" | …]
}
```

It degrades gracefully: brand/auth come back even if the service key is missing
(`warnings` flags what could not be fetched) rather than failing the whole page.
The backend fetches the catalogs with the SDK (`@norbix.ai/ts`) authenticated by
the key: `hub.membership.getRoles`, `hub.account.getProject` (→
`notificationSettings`), and `api.public.config` for brand/auth.

## `/api/proxy/{hub|api}/…` (reverse proxy)

The browser never calls the gateway directly. Every browser → gateway request
goes through this same-origin proxy, which re-targets to `HUB_BASE_URL` /
`API_BASE_URL` and forwards the user's JWT. So the gateway host is a server
secret, not a browser env. The proxy also stamps `norbix-env` from the server
`ENV` var when the browser didn't send one (self-hosted staging/test portals).

## The service-user API key

- Issued for a **service user** in the gateway (the Admin Portal `AdminPortalManager`
  role), carrying a narrow read-only scope: project roles + the
  marketing-preference structure + project read. The key is **write-once**: shown
  in Cloud at issuance, stored hashed by the gateway, never re-returned. Rotate by
  disabling → re-enabling the portal (or the explicit Rotate action) and pasting
  the new value into `API_KEY`.
- The SDK sends it as `Authorization: Bearer <key>` (see `Norbix({ apiKey })`).
- It is **server-only** and per-deployment.

## Managed vs self-hosted — TWO different structure paths

Two deployment flavours; the portal learns which from the Hub's `/echo`
(`release` = `ManagedService` | `SelfHosted` | `Enterprise`) — no env flag.
They read the sensitive **structure** by **different** access paths — NOT the
same call:

- **Managed** (Norbix-hosted): the managed server calls a **private structure/
  config API** reachable only inside Norbix's network (a K8s NetworkPolicy +
  internal ClusterIP — never the internet). The **network boundary is the
  authorization** — no API key, no key lookup, no key vending. It returns
  structure, never a key. The server passes `projectId`, derived from the
  end-user host/subdomain (never a browser field). The environment is derived
  from the host (e.g. `test.pr_x.admin.norbix.ai`).
- **Self-hosted** (forker): your backend calls the **public** Hub structure
  endpoint authenticated as the project's `AdminPortalManager` service-user key
  (in `API_KEY`), with normal IAM/tenancy clamping. OR you ship a hardcoded
  local layout config and skip the structure call entirely. Optionally set
  `ENV=staging` (or `test`) to target a non-prod environment; unset = PROD.
  Brand/theme/auth `config` may still come from the public config endpoint.

> The managed server holds and fetches **no** per-project API key. "Load the key
> from a store" / "call the Hub to get the key back" is an anti-pattern and is
> NOT how managed works — managed gets structure over the private network.

## Environment variables

Runtime (read by the Node server — NOT baked into the bundle):

| Var | Purpose |
| --- | --- |
| `API_KEY` | service-user API key (server-only). Required for the privileged catalogs. |
| `HUB_BASE_URL` | Hub base the backend calls, default `https://hub.norbix.ai`. |
| `API_BASE_URL` | API base the backend calls, default `https://api.norbix.ai`. |
| `API_VERSION` / `HUB_VERSION` | default `v3`. |
| `ENV` | **optional** Norbix environment (`staging`/`test`). Unset = PROD. Self-hosted only; managed derives it from the host. |
| `NEXT_PUBLIC_*` | anything the browser legitimately needs (e.g. config mode). |

> `IS_DEV` (in `src/config/env.ts`) is a separate, build-time "local dev build"
> flag (`NODE_ENV !== 'production'`). It only toggles Redux DevTools and the
> skip-remote config heuristic — it is NOT the Norbix `ENV` above.

Browser-facing config still uses the public, non-secret values; the project id
is resolved as before (pin → `pr_` subdomain → meta → managed-host lookup).

## Single Docker image

`deployments/Dockerfile` is multi-stage → `next build` with
`output: 'standalone'` → a minimal Node runtime image that serves UI + backend on
one port (3100), non-root. No nginx, no second container.

```bash
docker build -f deployments/Dockerfile -t norbix-admin .
docker run -p 3100:3100 -e API_KEY=… norbix-admin
```

## Forker extension points

- Add privileged server calls: new `app/api/<x>/route.ts` using
  `serviceClientForProject()` (or your own client / third-party SDKs).
- Add public/user calls: keep them browser-side with the user's JWT via the SDK
  through `/api/proxy/*`.
- Swap the service key scope, or point `HUB_BASE_URL` / `API_BASE_URL` at your
  own gateway.

## Migration status (Vite → Next, phased)

- ✅ Next app router + `output: 'standalone'` config, root tsconfig, Docker.
- ✅ `/api/bootstrap` (brand + auth + roles + marketing-pref catalog).
- ✅ `/api/proxy/*` full reverse proxy; browser SDK points at it.
- ⏳ Port the existing screens (`src/features/*`, `src/App.tsx` router) into
  `app/` routes. The Vite entry still exists during migration; the old build
  scripts are kept under `_vite:*` in `package.json` and removed once the port
  completes.
- ⏳ Wire the UI to consume `/api/bootstrap` for the preferences/roles screens;
  user-specific reads/writes stay direct via the SDK + JWT through `/api/proxy`.
