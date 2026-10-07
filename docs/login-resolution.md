# Login screen resolution

How the Admin Portal decides **which project** it is showing and **how** to
render the unauthenticated login screen.

## 1. Resolve the project id

On boot, the portal reads the project id from the **host**:

```
pr-4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2.admin.norbix.ai  →  projectId = "pr_5R4dlqJeXx943tOzSDEwbS"
admin.laimingaspilvukas.lt (CNAME → pr-4c0e….admin.norbix.ai) → host lookup → projectId
admin.norbix.ai           →  no projectId  →  blank placeholder
```

Rules:

- The host's leftmost label must match `^pr-([0-9a-f]{32})$`, any case — the
  gateway's `ProjectId.HostLabel` (`ProjectId.TryParseFromHost` reads it the
  same way). The 32 hex digits are the project Guid; the portal converts them
  to the `pr_{base62}` view id with the gateway's own steps
  (`Guid.ToByteArray` order → little-endian number → base62), tested against
  .NET output in `src/config/project.test.ts`.
- The old `pr_{base62}` host form is not read: `_` is not a legal host
  character and browsers lower-case the host, which breaks base62.
- A CNAME does not change the browser's visible host, so for custom domains
  the portal needs the id another way. Two supported mechanisms:
  1. **Build-time pin** (self-hosted/enterprise): `NEXT_PUBLIC_ADMIN_PROJECT_ID`
     is baked into the image (`--build-arg`). One image per project.
  2. **Edge header** (managed service custom domains): the ingress injects an
     `X-Norbix-Project` header / rewrites a known path that the runtime config
     shim reads. (See `devops.md`.)
- If no project id can be resolved → render the **blank placeholder** screen.

The resolved id is the single source of truth for the rest of the session and
is attached to every API request (header `X-Norbix-Project` or in the base
path, matching the gateway contract).

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

### Config mode (the "fork flag") — `VITE_ADMIN_CONFIG_MODE`

- **`dynamic` (default).** Start from the **neutral defaults**, fetch
  `GET {API}/public/projects/{id}/config`, and override. The endpoint returns
  brand (if exposed), the **social providers** + **passkey yes/no** (always),
  and **methods + password policy** only if the project opted in. If the call
  fails, the defaults stand — the portal always renders.
- **`static`.** Load brand + auth **entirely** from the bundled
  `config/projects/{id}.json`, **never** calling the endpoint. For forkers who
  want full control and the fastest paint. They can also edit components/CSS.

### Resolution order (dynamic mode)

```
1. fresh localStorage cache?            → use it
2. neutral defaults (email login, minLength-3 policy, no socials/passkey)
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
- each `socialProviders` entry → render its branded button; clicking it starts
  the OAuth flow against the API (`/auth/oauth/{provider}/start`).
- `registration` / `passwordReset` → show the corresponding links.
- `branding.primaryColor` themes the accent color via a CSS custom property,
  so a project's portal looks on-brand without a rebuild.
- `links.termsUrl` / `privacyUrl` → footer links to the public documents.

## 4. Why two paths instead of one

- Managed service can't ship a static file per tenant — there are too many and
  they change in Cloud at any time. Dynamic keeps it always-fresh.
- Self-hosted operators value a fast, offline-capable, auditable login screen
  and are happy to redeploy on change. Static gives them that, and because the
  image is open source they can read exactly what it renders.

Both share the **same** `LoginConfig` type and the **same** rendering code —
only the *source* differs, behind one `loadLoginConfig(projectId)` function.
