# Admin Portal — architecture

## 1. Where Admin sits among the portals

Norbix has four web/HTTP surfaces. Two are backend gateways, two are SPAs.

```
                         ┌─────────────────────────────────────────┐
                         │                BACKEND                   │
                         │                                          │
  developer / tenant ──► │  Hub      hub.norbix.ai / hub.<domain>   │ ◄── Cloud SPA
                         │           tenant + developer surface     │
                         │           (build project structure:      │
                         │            modules, integrations,        │
                         │            triggers, schemas, templates) │
                         │                                          │
  end-user apps   ─────► │  API      api.norbix.ai / api.<domain>   │ ◄── Admin SPA
                         │           end-user surface               │     (this project)
                         │           (what an app's user can do:    │
                         │            auth, profile, data, ...)     │
                         └─────────────────────────────────────────┘

                         ┌─────────────────────────────────────────┐
                         │                FRONTEND                  │
                         │                                          │
  developer / tenant ──► │  Cloud    cloud.norbix.ai / cloud.<dom.> │  talks to Hub
                         │           the Norbix dashboard. Build &  │
                         │           administer the project.        │
                         │                                          │
  end-user        ─────► │  Admin    admin.norbix.ai / admin.<dom.> │  talks to API
                         │           THIS PROJECT. The out-of-the-  │
                         │           box self-service portal for    │
                         │           the project's end users.       │
                         └─────────────────────────────────────────┘
```

**Key rule:** Cloud talks to **Hub**. Admin talks to **API**. The Hub is the
developer/tenant control plane; the API is the end-user data plane. The Admin
Portal only ever uses end-user-scoped API endpoints, plus a small number of
**public** API endpoints to render the login screen before the user is signed
in.

## 2. The problem Admin solves

A developer builds a project in Norbix (via Cloud). They may not have time to
build their own user-facing dashboard. The Admin Portal gives their users a
ready-made portal for the common things:

- **Auth management** — change / reset password, 2FA.
- **Profile / contact info** — edit `UserDto` profile fields.
- **Marketing preferences** — which marketing and transactional messages they
  want to receive.
- **Compliance** — request a copy of the data collected about them, request
  account removal, and read the project's public terms & policies.

It also gives the project a public, hostable **terms & policies** page. The
developer authors policies in Norbix and publishes them; the resulting public
URL can be pasted into App Store / Play Store listings, which require a
reachable privacy-policy URL. This is valuable when the developer has an app
but no website or portal yet.

## 3. The domain / project model

### 3.1 One portal, many projects

For **managed service** we cannot deploy a separate portal per tenant project.
There is **one** deployment at `admin.norbix.ai` serving every project.

The project is identified by the **subdomain**, not by a server-side registry:

```
pr_{base62}.admin.norbix.ai
└──┬─────┘
   └ the project id, base62-encoded, prefixed with "pr_"
```

- `admin.norbix.ai` (no `pr_` prefix) → **blank / placeholder page.** No
  project context, nothing to render. This is intentional.
- `pr_7Hk2.admin.norbix.ai` → the portal extracts `7Hk2`, treats it as the
  project id, calls the API for that project's public login settings, and
  renders the login screen.

### 3.2 Why subdomain, not a host→project registry

An earlier idea was: register every custom domain in a registry in the Hub,
have the portal resolve `Host` → project at request time. We rejected this:

- It needs a lookup (and a cache) on the hot path of every cold page load —
  worse latency and a new failure mode.
- It needs a domain-registration step and a registry to keep in sync.

Instead the **project id is mandatory and lives in the URL**. There is no
generic registry and no domain registration in the Hub. The subdomain alone
says which project we are talking about. This is simpler and faster.

> Note: the **Cloud** portal does resolve project from the `Host` header
> (`ProjectId.TryParseFromHost`) on the gateway side. Admin deliberately does
> **not** copy that — Admin puts the id in the subdomain prefix so no registry
> or gateway resolution is needed for a public, unauthenticated first paint.

### 3.3 Custom domains via CNAME

A developer who wants a branded portal points their own domain at ours:

```
admin.laimingaspilvukas.lt   CNAME   pr_7Hk2.admin.norbix.ai
```

Because the project id is baked into the CNAME **target**, the portal still
knows the project even though the browser shows the custom host. No registry
needed. (TLS for the custom host is handled at the ingress / cert layer — see
`devops.md`.)

### 3.4 The full naming picture for one project

For a project "laimingaspilvukas":

| Surface | Managed-service host | Branded (CNAME) host |
| --- | --- | --- |
| Public website | — | `laimingaspilvukas.lt` |
| End-user portal (Admin) | `pr_7Hk2.admin.norbix.ai` | `admin.laimingaspilvukas.lt` |
| Developer dashboard (Cloud) | `cloud.norbix.ai` | `cloud.laimingaspilvukas.lt` |
| End-user API | `api.norbix.ai` | `api.laimingaspilvukas.lt` |
| Tenant/dev Hub | `hub.norbix.ai` | `hub.laimingaspilvukas.lt` |

## 4. Login screen: dynamic vs static

The unauthenticated login screen must reflect the **membership settings**
defined for the project in Cloud — e.g. if the project enables email/password
**and** Google + GitHub social logins, the screen shows an email/password form
**plus** those social icons. There are two ways to obtain that config; both
are supported (see [`login-resolution.md`](./login-resolution.md) for detail).

1. **Dynamic (managed service, default).** The portal reads the project id
   from the subdomain and calls a **public** API endpoint for that project's
   login settings, then renders the screen at runtime. No redeploy needed when
   the developer changes settings. Slightly slower first paint (one network
   round-trip before the form appears).

2. **Static (self-hosted / enterprise).** Because the self-hosted Admin image
   is **open source**, the operator can ship a `config/projects/{projectId}.json`
   (or `.yaml`) describing the login screen and redeploy. The portal renders
   from the bundled/served config **without** a network call — fastest paint.
   Falls back to the dynamic path if no static entry exists.

Resolution order at runtime: **static config (if present for this project) →
dynamic API call → blank placeholder (no project / not found).**

## 5. Deployment flavors

Same single codebase, three flavors gated on a build-time flag
(`VITE_ADMIN_RELEASE`), exactly like Cloud's `VITE_CM_RELEASE`:

| Flavor | Host | Login config | Notes |
| --- | --- | --- | --- |
| **ManagedService** | `pr_*.admin.norbix.ai` | Dynamic only | One deployment, wildcard subdomain, all tenants. |
| **SelfHosted** | `admin.<customer>` | Static first, dynamic fallback | Operator ships per-project static config + redeploys. Open source. |
| **Enterprise** | `admin.<customer>` | Static first, dynamic fallback | Same as self-hosted; larger SLAs / private images. |

## 6. Endpoint discovery via Hub `/echo`

The only endpoint the portal is configured with is the **Hub URL**
(`VITE_ADMIN_HUB_BASE_URL`). On boot it calls `GET {hub}/{version}/echo` and
gets back everything else:

```jsonc
{
  "release": "ManagedService",
  "runtime": "Development",
  "hubUrl": "http://localhost:5001/v3",
  "apiUrl": "http://localhost:5002/v3",     // ← the portal targets this
  "apiVersion": "v3", "hubVersion": "v3",
  "managedServiceHubUrl": "https://hub.norbix.ai/v3",
  "managedServiceApiUrl": "https://api.norbix.ai/v3",
  "mjmlUrl": "https://mjml.norbix.ai/",
  "license": { "domain": "...", "release": "managedService", "isTrial": false, ... },
  "askForEnterpriseLicenseEmail": "licensing@norbix.ai",
  "regions": [
    { "code": "nb-eu-germany", "displayName": "EU — Germany (Frankfurt)",
      "apiUrl": "https://nb-eu-germany...", "hubUrl": "https://nb-eu-germany..." }
  ]
}
```

The response is stored in the `config` Redux slice; the API base query reads
`apiUrl` from it at request time, so configuring one Hub URL is enough. The
`apiUrl` env value is only a fallback when echo is unreachable. The contract
matches `EchoResponse` in the gateway
(`Isidos.CodeMash.Services.Api/Heartbeat/Echo.cs`); the Cloud portal consumes
the same endpoint. Regions feed a future region selector; release/license can
gate Enterprise-only UI.

## 7. Backend contract (API gateway)

The Admin Portal needs these classes of API endpoints. Exact routes are owned
by the gateway repo; this is the contract Admin depends on.

- **Public (no auth):** project public login settings (which providers, social
  buttons, branding, links to published terms/policies), and the published
  terms & policies documents themselves.
- **Auth:** sign-in (credentials + OAuth callback), sign-out, password reset
  request + confirm, password change, 2FA enroll / verify / disable.
- **Profile:** read & update the end-user `UserDto` profile / contact fields.
- **Marketing preferences:** read & update marketing-state per channel /
  subscription.
- **Compliance:** request data export ("what do you hold about me"), request
  account deletion, read consent/data-usage info.

All authenticated calls are **end-user-scoped** and carry the project context
(project id from the subdomain → sent as a header / in the API base path).
Admin never calls Hub endpoints.

## 8. Future: own records

A later phase adds an "own records" area: the end user sees database records
that belong to them, and — gated by their permissions — can create/read/
update/delete their own records. This reuses the same API data-plane endpoints
the SDKs already expose. Documented as a non-MVP item in `features.md`.
