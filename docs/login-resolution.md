# Login screen resolution

How the Admin Portal decides **which project** it is showing and **how** to
render the unauthenticated login screen.

## 1. The project id comes from configuration

The portal serves one project: the one named in the server variable
`PROJECT_ID`.

```
PROJECT_ID=pr_5R4dlqJeXx943tOzSDEwbS      →  the portal shows this project
PROJECT_ID missing, or not a project id  →  the setup screen
```

Rules:

- The server reads `PROJECT_ID` on every request (`app/lib/portalSetup.ts`)
  and writes it into the page as `<meta name="norbix-project">`. The browser
  reads that tag (`resolveProjectId` in `src/config/project.ts`).
- The value is the project's id as Cloud shows it, `pr_…`. The host-label form
  `pr-<32 hex>` is accepted too and converted to the `pr_…` id with the
  gateway's own steps (`Guid.ToByteArray` order → little-endian number →
  base62), tested against .NET output in `src/config/project.test.ts`.
- The address the portal is opened at **never** decides the project. Host it
  at any address you like (`admin.example.com`).
- There is no build-time pin: one build serves any project.
- With no `PROJECT_ID` (or no `API_KEY`) every page shows the setup screen,
  which names the missing variable. See
  [`backend.md`](./backend.md), "Configuration".

The id is attached to every API request as the `nb-project-id` and
`norbix-project-id` headers (`setProjectHeaders`).

## 2. Obtain the login config

A `LoginConfig` describes the login screen:

```ts
interface ProjectConfig {
  projectId: string;
  branding: {
    displayName: string;
    mainColor?: string;    // Hub Brand.MainColor  → --admin-primary (+hover)
    accentColor?: string;  // Hub Brand.AccentColor → --admin-accent
    logoUrl?: string;      // Hub Brand.Logo  → login + header
    iconUrl?: string;      // Hub Brand.Icon  → favicon
    backgroundUrl?: string;
  };
  auth: {
    emailPassword: boolean;            // show email + password form
    registration: boolean;             // show "create account" link
    passwordReset: boolean;            // show "forgot password" link
    socialProviders: SocialProvider[]; // google | github | facebook | apple | ...
  };
  links: { termsUrl?: string; privacyUrl?: string };
}
```

The config carries **brand** and **auth options**. It is stored in the
`project` Redux slice and TTL-cached in `localStorage`. The public endpoint is
gated by two project opt-in flags — full design in
[`public-config-endpoint.md`](./public-config-endpoint.md).

### Config mode — `NEXT_PUBLIC_ADMIN_CONFIG_MODE`

- **`dynamic` (default).** Start from the **neutral defaults**, fetch
  `GET {API}/public/projects/{id}/config`, and override. The endpoint returns
  brand (if exposed), the **social providers** + **passkey yes/no** (always),
  and **methods + password policy** only if the project opted in. If the call
  fails, the defaults stand — the portal always renders.
- **`static`.** Load brand + auth **entirely** from the bundled
  `config/projects/{id}.json`, **never** calling the endpoint. For full control
  and the fastest paint. You can also edit components/CSS.

> **Not complete in the Next.js build.** The bundled
> `config/projects/{id}.json` file is read with a Vite-only feature
> (`import.meta.glob`, `src/config/projectConfig.ts`). Under Next.js the file
> is not loaded: `static` then means "the neutral defaults, no call", and in
> `dynamic` mode the static layer is skipped. Use `dynamic` unless you wire
> the file in yourself.

### Resolution order (dynamic mode)

```
1. fresh localStorage cache?            → use it
2. neutral defaults (email login, minLength-6 policy, no socials/passkey)
     ← merge bundled static config (if config/projects/{id}.json exists)
     ← merge public /config response (brand + safe auth; sensitive auth if opted-in)
   (each layer overrides only the fields it sets)
3. endpoint fails → defaults (+ static) stand — never a blank screen
```

Brand mapping is **conservative**: `mainColor` → `--admin-primary`,
`accentColor` → `--admin-accent`; else neutral grey/white. A JSON schema for
the static file lives at `config/login-config.schema.json`.

### Security: public endpoint = strict allow-list, not CORS

The endpoint is public and **id-addressable**, so its response is world-readable
and harvestable at scale. Safety comes from the **shape**, not CORS:

- Brand + "which socials/passkey exist" are low-risk (a visitor sees the login
  buttons anyway).
- The sensitive auth detail (identifier **methods** + **password policy**) is
  **opt-in** (default OFF). When off, the portal uses defaults.
- **CORS does not secure this** — it's browser-only (controls which web origins
  may *read* a response in JS); `curl`/scripts ignore it. Never an access
  control. See [`public-config-endpoint.md`](./public-config-endpoint.md).

## 3. Rendering

- `emailPassword` → render the email + password form.
- each `socialSignIn` entry → render its button; clicking it sends the browser
  to `{API host}{startPath}&returnUrl={portal}/oauth/callback`
  ([`social-sign-in.md`](./social-sign-in.md)).
- `registration` / `passwordReset` → show the corresponding links.
- `branding.primaryColor` themes the accent color via a CSS custom property,
  so a project's portal looks on-brand without a rebuild.
- `links.termsUrl` / `privacyUrl` → footer links to the public documents.

## 4. Why two config modes

- **Dynamic** keeps the login screen in step with what the project owner sets
  in Cloud (brand, sign-in methods) with no redeploy.
- **Static** gives a fast, offline-capable, auditable login screen for an
  owner who is happy to redeploy on change.

Both share the **same** `ProjectConfig` type and the **same** rendering code —
only the *source* differs, behind one `loadProjectConfig(projectId)` function.
