# Admin Portal — architecture

## 1. Where Admin sits among the portals

Norbix has four web/HTTP surfaces. Two are backend gateways, two are web
apps.

```
                         ┌─────────────────────────────────────────┐
                         │                BACKEND                   │
                         │                                          │
  developer / tenant ──► │  Hub      hub.norbix.ai                  │ ◄── Cloud SPA
                         │           tenant + developer surface     │
                         │           (build project structure:      │
                         │            modules, integrations,        │
                         │            triggers, schemas, templates) │
                         │                                          │
  end-user apps   ─────► │  API      api.norbix.ai                  │ ◄── Admin Portal
                         │           end-user surface               │     (this project)
                         │           (what an app's user can do:    │
                         │            auth, profile, data, ...)     │
                         └─────────────────────────────────────────┘

                         ┌─────────────────────────────────────────┐
                         │                FRONTEND                  │
                         │                                          │
  developer / tenant ──► │  Cloud    cloud.norbix.ai                │  talks to Hub
                         │           the Norbix dashboard. Build &  │
                         │           administer the project.        │
                         │                                          │
  end-user        ─────► │  Admin    admin.<your domain>            │  talks to API
                         │           THIS PROJECT. The out-of-the-  │
                         │           box self-service portal for    │
                         │           the project's end users. You   │
                         │           host it; Norbix does not.      │
                         └─────────────────────────────────────────┘
```

**Key rule:** Cloud talks to **Hub**. Admin talks to **API**. The Hub is the
developer/tenant control plane; the API is the end-user data plane. The Admin
Portal only ever uses end-user-scoped API endpoints, plus a small number of
**public** API endpoints to render the login screen before the user is signed
in. Its own backend also reads three things from the Hub with the service
user's key: the portal layout, the role names and the communication structure
([`backend.md`](./backend.md)).

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

## 3. One portal, one project — hosted by the project owner

Norbix does not host the Admin Portal. This repository is a starter: the
developer of a project clones it, sets two values and hosts it on their own
address.

```
admin.example.com   ──►   your copy of this portal   ──►   hub.norbix.ai / api.norbix.ai
                          PROJECT_ID=pr_…
                          API_KEY=…  (Admin Portal service user)
```

- **The project comes from configuration.** `PROJECT_ID` on the server names
  the project. The address the portal is opened at never decides it; there is
  no host → project lookup anywhere.
- **The key stays on the server.** `API_KEY` belongs to the project's Admin
  Portal service user (role `AdminPortalManager`). The browser never sees it.
- **The browser talks only to the portal.** Every call goes to the portal's
  own backend (`/api/proxy/*`, `/api/structure`, `/api/bootstrap`), which
  calls the Hub / API.
- **The project must know the portal's address.** In Norbix Cloud the owner
  saves the portal's address as the project's "Admin portal URL". That adds it
  to the allowed origins (CORS) and makes e-mail links (password reset,
  invitation) point to the portal.
- **Not set up → a setup screen.** Without `PROJECT_ID` or `API_KEY` the
  portal shows a page that names the missing variable
  ([`backend.md`](./backend.md), "Configuration").

For a project "example":

| Surface | Address |
| --- | --- |
| Public website | `example.com` |
| End-user portal (this project, hosted by the owner) | `admin.example.com` |
| Developer dashboard (Cloud) | `cloud.norbix.ai` |
| End-user API | `api.norbix.ai` (per project: `pr-<32 hex>.api.norbix.ai`) |
| Tenant/dev Hub | `hub.norbix.ai` |

## 4. Login screen: dynamic vs static

The unauthenticated login screen must reflect the **membership settings**
defined for the project in Cloud — e.g. if the project enables email/password
**and** Google + GitHub social logins, the screen shows an email/password form
**plus** those social icons. There are two ways to obtain that config; both
are supported (see [`login-resolution.md`](./login-resolution.md) for detail).

1. **Dynamic (default).** The portal calls a **public** API endpoint for the
   configured project's login settings, then renders the screen at runtime. No
   redeploy needed when the developer changes settings in Cloud. Slightly
   slower first paint (one network round-trip before the form appears).

2. **Static.** You ship a `config/projects/{projectId}.json` describing the
   login screen and redeploy. The portal renders from the bundled config
   **without** a network call — fastest paint. (Not complete in the Next.js
   build: see the note in [`login-resolution.md`](./login-resolution.md).)

## 5. Deployment

One codebase, one mode. Build the image from `deployments/Dockerfile` (or run
`npm run build` + `npm run start` on any Node host), give it `PROJECT_ID` and
`API_KEY`, and put it behind your own address with TLS. See
[`devops.md`](./devops.md).

## 6. Endpoint discovery via Hub `/echo`

On boot the portal calls `GET {hub}/{version}/echo` (through its own proxy;
the Hub address is the server variable `HUB_BASE_URL`, default
`https://hub.norbix.ai`) and gets back:

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

The response is stored in the `config` Redux slice. The browser does not call
`apiUrl` itself: it calls the portal's proxy, and the portal backend picks the
API address — `API_BASE_URL`, or the project's own host built from
`apiUrlTemplate` ([`backend.md`](./backend.md)). The one exception is the
social sign-in start, which the browser opens on the API host
([`social-sign-in.md`](./social-sign-in.md)). The contract matches
`EchoResponse` in the gateway; the Cloud portal consumes the same endpoint.
The portal does not need `adminUrlTemplate` from it.

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
(the configured project id, sent as the `nb-project-id` /
`norbix-project-id` headers).

## 8. Future: own records

A later phase adds an "own records" area: the end user sees database records
that belong to them, and — gated by their permissions — can create/read/
update/delete their own records. This reuses the same API data-plane endpoints
the SDKs already expose. Documented as a non-MVP item in `features.md`.
