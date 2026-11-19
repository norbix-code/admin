# Admin Portal — the backend

The portal is a **Next.js app (app router)** that you host yourself, as **one
Docker image** or on any Node host. One Node process serves both the React UI
and the server-side route handlers (`app/api/*`).

It serves **one project**. The project and the key come from two server
variables, `PROJECT_ID` and `API_KEY`, and from nowhere else (see
"Configuration" below).

## Why a backend (not a pure SPA)

Some data the portal renders is **privileged** and must not be fetchable with an
end user's low-privilege token:

- the project's **roles** catalog (display names),
- the **marketing-preferences structure** (the groups/channels/tags a user opts
  in/out of),
- later: **schema-driven forms** and per-deployment **third-party** integrations.

A browser SPA cannot hold a privileged credential. So a thin server backend holds
a **service-user API key** (scoped read-only) and fetches the catalog server-side.
You extend the portal by adding your own `app/api/*` routes that call your
own services — the reason this is a backend and not just static files.

## What runs where

| Concern | Where | Auth |
| --- | --- | --- |
| Privileged catalog (roles, marketing-pref structure) | **backend** (`/api/bootstrap`) | service-user API key (server env) |
| Portal layout (which pages are on) | **backend** (`/api/structure`) | service-user API key (server env) |
| Brand + auth config | backend (folded into `/api/bootstrap`) | served once for fewer round-trips |
| Everything else: user data, login, echo | **browser → `/api/proxy/*` → gateway** | the user's JWT (via the SDK) |

The service-user API key **never reaches the browser**. `app/lib/serverNorbix.ts`
imports `server-only`, so the build fails if a client component ever pulls it in.
The reverse proxy (`/api/proxy/*`) forwards only the user's JWT — never the key.

## `/api/bootstrap`

`GET /api/bootstrap` → one trusted server-side call returning:

```jsonc
{
  "projectId": "pr_…",               // the configured project
  "branding": { … } | null,          // public brand
  "auth": { … } | null,              // public auth options
  "roles": [ { "id", "name", "displayName" } ],   // PRIVILEGED
  "marketingPreferences": { … } | null,           // PRIVILEGED structure
  "warnings": ["config-unavailable" | "roles-unavailable" | "preferences-unavailable"]
}
```

It degrades gracefully: when one read fails, the others still come back and
`warnings` says what is missing. The backend fetches the catalogs with the SDK
(`@norbix.ai/ts`) authenticated by the key: `hub.membership.getRoles`,
`hub.account.getProject` (→ `notificationSettings`), and
`api.public.getPublicProjectConfig` for brand/auth.

The project is always the configured one. A `projectId` in the query is not
read.

## `/api/structure`

`GET /api/structure` → the portal layout: the project's display name and the
list of modules (Profile, Security, Preferences, …) that are on. The backend
calls the Hub's

```
GET {hub}/v3/account/projects/{projectId}/admin-portal/structure
```

as the service user, for the configured project. When the call fails it
answers a default layout (all standard pages on) with
`warnings: ["structure-unreachable"]`, so the portal still renders.

## `/api/proxy/{hub|api}/…` (reverse proxy)

The browser never calls the gateway directly. Every browser → gateway request
goes through this same-origin proxy, which re-targets to `HUB_BASE_URL` /
`API_BASE_URL` and forwards the user's JWT. So the gateway host is a server
server setting, not a browser one. The proxy also stamps `norbix-env` from the
server `ENV` variable when the browser didn't send one (staging/test portals).

**A project's own API host.** Norbix processes a project in one region. The
Hub's `/echo` announces `apiUrlTemplate`
(`https://{projectHostLabel}.api.<domain>/v3`) and the shared API host refuses
a project that another region processes (`CM-ERRORS-PROJECTS-040`). So an API
call goes to the project's own host, `pr-<32 hex>.api.<domain>`, which DNS
sends to the right region. The backend reads the template from the Hub (kept
5 minutes; the last good answer stays through a failed read) and builds the
host from the template plus the 32 hex digits of the **configured**
`PROJECT_ID` — never from a header, the address the portal was opened at, or
other text in the request (`app/lib/projectApi.ts`,
`src/config/projectApiHost.ts`). This happens only when `API_BASE_URL` is the
shared host the template stands on (`api.<domain>`); pointed at the API by
another address, the portal keeps that address. With no template in `/echo`
every call goes to `API_BASE_URL`. There is no setting for this: it follows
what the Hub says.

Social sign-in is not covered by this: the gateway keeps its start and its
callback on the shared API host ([`social-sign-in.md`](./social-sign-in.md)).

## The service-user API key

- It belongs to the project's **Admin Portal service user** (role
  `AdminPortalManager`), which you create or assign in Norbix Cloud → Project
  Settings → Admin Portal. Its scope is narrow and read-only: the portal
  structure, project roles, the marketing-preference structure and the project
  read.
- The key is shown **once**, when it is created. Norbix stores only a hash. To
  change it, create a new key for the service user and put the new value into
  `API_KEY`.
- The SDK sends it as `Authorization: Bearer <key>` (see `Norbix({ apiKey })`).
- It is **server-only**: `/api/bootstrap` and `/api/structure` use it; the
  proxy never adds it to a user's call.

## Configuration

Two values are required. Both are read by the Node server at run time, on
every request — they are not baked into the build, so one image works for any
project.

| Variable | What it is |
| --- | --- |
| `PROJECT_ID` | The project this portal serves: `pr_…` (the `pr-<32 hex>` form is accepted too). |
| `API_KEY` | The API key of the project's Admin Portal service user. |

The server writes the checked `PROJECT_ID` into the page as
`<meta name="norbix-project">`; the browser reads it from there
(`src/config/project.ts`). The address the portal is opened at never decides
the project, and neither does a header or a query value.

**When one is missing** (`app/lib/portalSetup.ts`):

- every page shows the setup screen "This portal is not set up yet", which
  names the variable to fix (`app/SetupRequired.tsx`). A `PROJECT_ID` that is
  not a project id counts as missing. No value is ever shown;
- `/api/bootstrap`, `/api/structure` and `/api/proxy/*` answer
  `503 { "error": "portal-not-set-up", "missing": ["PROJECT_ID" | "API_KEY"], "message": "…" }`
  and call nothing upstream;
- the server logs one line, once per process:
  `[admin-portal] Not set up: PROJECT_ID is not set. … See README.md, "Quick start".`

There is no fallback to another project.

## Environment variables

Runtime (read by the Node server — NOT baked into the bundle):

| Var | Purpose |
| --- | --- |
| `PROJECT_ID` | **required** — the project (above). |
| `API_KEY` | **required** — the service-user API key (server-only). |
| `ENV` | optional project environment (`staging`/`test`). Unset = PROD. |
| `HUB_BASE_URL` | Hub base the backend calls, default `https://hub.norbix.ai`. |
| `API_BASE_URL` | API base the backend calls, default `https://api.norbix.ai`. When the Hub announces `apiUrlTemplate`, the project's calls go to its own host instead (above). |
| `API_VERSION` / `HUB_VERSION` | default `v3`. |

Build time (inlined into the browser bundle by `next build`):

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_ADMIN_CONFIG_MODE` | `dynamic` (default). `static` is not complete in the Next.js build — see [`login-resolution.md`](./login-resolution.md). |

> `IS_DEV` (in `src/config/env.ts`) is a separate, build-time "local dev build"
> flag (`NODE_ENV !== 'production'`). It only toggles Redux DevTools and the
> skip-remote config heuristic — it is NOT the Norbix `ENV` above.

## Single Docker image

`deployments/Dockerfile` is multi-stage → `next build` with
`output: 'standalone'` → a minimal Node runtime image that serves UI + backend on
one port (3100), non-root. No nginx, no second container.

```bash
docker build -f deployments/Dockerfile -t my-admin-portal .
docker run -p 3100:3100 -e PROJECT_ID=pr_… -e API_KEY=… my-admin-portal
```

## Extension points

- Add privileged server calls: new `app/api/<x>/route.ts` using
  `readyPortalSetup()` + `serviceClient()` (or your own client / third-party
  SDKs).
- Add public/user calls: keep them browser-side with the user's JWT via the SDK
  through `/api/proxy/*`.
- Change the pages, the theme and the texts: it is your copy of the code.

## Migration status (Vite → Next, phased)

- ✅ Next app router + `output: 'standalone'` config, root tsconfig, Docker.
- ✅ `/api/bootstrap` (brand + auth + roles + marketing-pref catalog) and
  `/api/structure`.
- ✅ `/api/proxy/*` full reverse proxy; browser SDK points at it.
- ⏳ Port the existing screens (`src/features/*`, `src/App.tsx` router) into
  `app/` routes. The Vite entry still exists during migration; the old build
  scripts are kept under `_vite:*` in `package.json` and removed once the port
  completes.
- ⏳ Wire the UI to consume `/api/bootstrap` for the preferences/roles screens;
  user-specific reads/writes stay direct via the SDK + JWT through `/api/proxy`.
