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
(`NEXT_PUBLIC_ADMIN_CONFIG_MODE`):

1. **Developer passes config** (`static`) — bundled `config/projects/{id}.json`,
   no network. The fast path.
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

- Data access uses **`@norbix.ai/react-redux`** (RTK Query over the typed
  `@norbix.ai/ts` SDK), not hand-written services.
- Both packages come from npm (since 2026-10-03). An SDK change is tried
  locally before it is published — see
  [`sdk-local-development.md`](./sdk-local-development.md).

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

## 6. Admin portal URL

- Norbix does not give a project a portal address. The project owner hosts the
  portal and saves its address in Norbix Cloud as the project's **Admin portal
  URL**.
- Saving it adds the address to the project's allowed origins (CORS). It is
  also what password-reset and invitation links and the
  `@Model.Project.AdminUrl` email token use.

## 7. Deployment model

- One portal serves one project. The project and the service user's key come
  from the server variables `PROJECT_ID` and `API_KEY`. See
  [`architecture.md`](./architecture.md) and [`backend.md`](./backend.md).
- Docker image or any Node host: [`devops.md`](./devops.md).
