# Admin Portal — design agreements

The decisions we settled on for the open-source Admin Portal. Each links to the
detailed doc. This is the "why it is the way it is" record.

## 1. Customizable CSS (theming without forking)

- The portal is themed entirely through **CSS design tokens** (`--admin-*` in
  `src/styles.css`), mapped onto Tailwind utilities (`tailwind.config.cjs`).
  Override the tokens in one stylesheet and the whole portal re-skins — no
  component edits. Defaults are neutral grey/white with Norbix blue used
  conservatively.
- UI components are built on **Headless UI** (MIT) + plain Tailwind — no paid
  Tailwind UI / Catalyst, so the repo is safe to open source (MIT).
- The project's Hub **Brand** (MainColor, AccentColor, Logo, Icon) overrides the
  token defaults at runtime, conservatively (main → primary, accent → accent).
- Full guide: [`theming.md`](./theming.md).

## 2. Configs (three ways to run it)

A project's brand + auth options come from a `ProjectConfig`, resolved by mode
(`VITE_ADMIN_CONFIG_MODE`):

1. **Developer passes config** (`static`) — bundled `config/projects/{id}.json`,
   no network. Forker's fast path.
2. **Own deployment / fork** — edit components, CSS, or config directly.
3. **Call the Hub** (`dynamic`, default) — fetch the public endpoint, merge over
   neutral defaults; on failure, defaults stand (never a blank screen).

All three produce the same shape. Full design:
[`login-resolution.md`](./login-resolution.md).

## 3. Hub access (what's exposed, and safely)

- The portal needs only the **Hub URL**; it discovers the API URL etc. from
  `/echo`. See [`architecture.md`](./architecture.md) §6.
- Brand + auth options come from a **public, unauthenticated** endpoint
  `GET /public/projects/{id}/config`, gated by two project opt-in flags
  (brand default ON, auth detail default OFF). Social providers + passkey
  yes/no are always returned; identifier methods + password policy only when
  the project opts in.
- **CORS is not a security boundary** — it's browser-only. The safety guarantee
  is the **response shape** (a strict public allow-list: no secrets, no internal
  URLs, sensitive auth detail opt-in). Backend design:
  [`public-config-endpoint.md`](./public-config-endpoint.md) and the gateway's
  `docs/architecture/AdminPortal.PublicConfig.md`.
- Social/passkey sign-in are full-page links to the gateway
  (`{api}/auth/{provider}?projectId=…`); the gateway owns all secrets/redirects.

## 4. SDK + dev loop

- Data access uses **`@norbix/react-redux`** (RTK Query over the typed
  `@norbix.ai/ts` SDK), not hand-written services.
- Local development links the SDK from source for instant HMR — no publish
  cycle. See [`sdk-local-development.md`](./sdk-local-development.md).

## 5. Legal documents (Terms & Conditions, Privacy Policy)

- A project authors **Terms & Conditions** and a **Privacy Policy** as
  **Markdown** in Cloud → **Project → Project Settings → Access** (a new tab,
  after Webhooks, before project termination). No drafts/versioning — set, save,
  stored in Redis (project read model).
- A **third checkbox** on that tab — *expose legal documents* (default **OFF**)
  — makes them publicly readable (no admin auth) via the portal at
  `/legal/terms` and `/legal/privacy` (short aliases `/terms`, `/policies`).
  Stable URLs for App Store / Play Store listings.
- Gateway: public `GET /public/projects/{id}/legal/{terms|privacy}` (unsecured
  query, gated by the flag) + authenticated Hub PATCH endpoints to set the
  Markdown and toggle the flag. Full design:
  gateway `docs/architecture/AdminPortal.PublicConfig.md`.
- **Cloud UI (spec — to build in the Cloud repo):** the *Access* tab under
  Project Settings with two Markdown textareas (Terms, Privacy), an Update
  button, and the *expose legal documents* checkbox. Wire to the two Hub PATCH
  endpoints above.

## 6. Admin-portal URL (canonical + override)

- Every project has a **canonical** admin address `https://pr_{id}.admin.{host}`
  — deterministic, always constructable (the host is mandatory). It's the
  default CORS-seeded origin and is shown **read-only** in Cloud → Project
  Settings → Access.
- A developer can **override** it per project (`AdminUrl`, default null) when
  CNAMEing a custom domain or deploying the portal elsewhere. The override's
  origin is also added to CORS. The **effective** URL (override ?? canonical) is
  what password-reset links and the `@Model.Project.AdminUrl` email token use.
- **Cloud UI (spec):** on the Access tab, show the canonical URL read-only and
  an editable `AdminUrl` field (empty = use canonical), wired to Hub `PATCH
  .../settings/admin-url`. Backend design: gateway
  `docs/architecture/AdminPortal.PublicConfig.md`.

## 7. Deployment model

- One portal serves many projects; the project id is in the `pr_{base62}`
  subdomain. New projects auto-seed `pr_{id}.admin.{host}` into their CORS
  allow-list on creation. See [`architecture.md`](./architecture.md) and the
  gateway decision `docs/decisions/auto-seed-admin-cors-origin.md`.
- Docker + k8s (managed-service + self-hosted, wildcard ingress):
  [`devops.md`](./devops.md).
