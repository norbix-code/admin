# Admin Portal — backend-for-frontend (BFF)

The portal is a **Next.js app (app router)** shipped as **one self-hostable
Docker image** — no Vercel. One Node process serves both the React UI and the
server-side BFF (`app/api/*`). This replaces the old static-only Vite + nginx
image.

## Why a backend (not a pure SPA)

Some data the portal renders is **privileged** and must not be fetchable with an
end user's low-privilege token:

- the project's **roles** catalog (display names),
- the **marketing-preferences structure** (the groups/channels/tags a user opts
  in/out of),
- later: **schema-driven forms** and per-deployment **third-party** integrations.

A browser SPA cannot hold a privileged credential. So a thin BFF holds a
**service-user API key** (scoped read-only) and fetches the catalog server-side.
Forkers extend the portal by adding their own `app/api/*` routes that call their
own services — the reason this is a backend and not just static files.

## What runs where

| Concern | Where | Auth |
| --- | --- | --- |
| Privileged catalog (roles, marketing-pref structure) | **BFF** (`/api/bootstrap`) | service-user API key (server env) |
| Brand + auth config | BFF (folded into `/api/bootstrap`) | none (public), served once for fewer round-trips |
| User's OWN data (profile, preferences values, password, passkeys) | **browser → API directly** | the user's JWT (via the SDK) |
| Custom-domain → projectId resolution | browser → managed Hub `/admin-portal-id` | none (id-only) |

The service-user API key **never reaches the browser**. `app/lib/serverNorbix.ts`
imports `server-only`, so the build fails if a client component ever pulls it in.

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
The BFF fetches the catalogs with the SDK (`@norbix.ai/ts`) authenticated by the
key: `hub.membership.getRoles`, `hub.account.getProject` (→ `notificationSettings`),
and `api.public.config` for brand/auth.

## The service-user API key

- Generated as a **service user** in the gateway with **ServiceStack
  `ApiKeyFeature`**, carrying a narrow read-only scope: project roles + the
  marketing-preference structure + project read (for `notificationSettings`).
  Today that maps to the existing permissions `membership:read` +
  `membership:role:all` and `project:read` / `project:settings:all`. A dedicated
  `membership:catalog:read` permission can be added later to tighten it.
- The SDK sends it as `Authorization: Bearer <key>` (see `Norbix({ apiKey })`).
- It is **server-only** and per-deployment — rotate by changing the env var.

## Environment variables

Runtime (read by the Node server — NOT baked into the bundle):

| Var | Purpose |
| --- | --- |
| `ADMIN_BFF_API_KEY` | service-user API key (server-only). Required for the privileged catalogs. |
| `ADMIN_BFF_HUB_BASE_URL` | Hub base the BFF calls, default `https://hub.norbix.ai`. |
| `ADMIN_BFF_API_BASE_URL` | API base the BFF calls, default `https://api.norbix.ai`. |
| `ADMIN_BFF_API_VERSION` / `ADMIN_BFF_HUB_VERSION` | default `v3`. |
| `NEXT_PUBLIC_*` | anything the browser legitimately needs (e.g. config mode). |

Browser-facing config still uses the public, non-secret values; the project id
is resolved as before (pin → `pr_` subdomain → meta → managed-host lookup).

## Single Docker image

`deployments/Dockerfile` is multi-stage → `next build` with
`output: 'standalone'` → a minimal Node runtime image that serves UI + BFF on
one port (3100), non-root. No nginx, no second container.

```bash
docker build -f deployments/Dockerfile -t norbix-admin .
docker run -p 3100:3100 -e ADMIN_BFF_API_KEY=… norbix-admin
```

## Forker extension points

- Add privileged server calls: new `app/api/<x>/route.ts` using
  `serviceClientForProject()` (or your own client / third-party SDKs).
- Add public/user calls: keep them browser-side with the user's JWT via the SDK.
- Swap the service key scope, or point `ADMIN_BFF_*` at your own gateway.

## Migration status (Vite → Next, phased)

- ✅ Next app router + `output: 'standalone'` config, root tsconfig, Docker.
- ✅ BFF `/api/bootstrap` (brand + auth + roles + marketing-pref catalog).
- ⏳ Port the existing screens (`src/features/*`, `src/App.tsx` router) into
  `app/` routes. The Vite entry still exists during migration; the old build
  scripts are kept under `_vite:*` in `package.json` and removed once the port
  completes.
- ⏳ Wire the UI to consume `/api/bootstrap` for the preferences/roles screens;
  user-specific reads/writes stay direct via the SDK + JWT.
