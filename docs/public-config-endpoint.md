# Public project config — final design

How the Admin Portal learns a project's **brand** and **auth options** safely.

## The endpoint

```
GET /{version}/public/projects/{id}/config        (public, unauthenticated)
```

Returns ONLY public, non-sensitive data. What's included is gated by two opt-in
flags the developer sets in **Cloud → Membership → Access**.

```jsonc
{
  // Present only if "expose brand" is ON (default ON):
  "branding": {
    "displayName": "Acme",
    "mainColor": "#0A558C",
    "accentColor": "#2680C2",
    "logoUrl": "https://…",
    "iconUrl": "https://…"
  },

  "auth": {
    // ALWAYS present (low-risk, needed to render the login screen):
    "socialProviders": ["facebook", "google"],
    "passkey": true,

    // Present only if "expose auth settings" is ON (default OFF):
    "methods": ["email", "phone", "username"],
    "passwordPolicy": { "minLength": 3, "minNumbers": 1, "...": "..." }
  }
}
```

### What's safe vs. gated

| Field | Exposure |
| --- | --- |
| `branding.*` | gated by **expose brand** (default ON) — harmless either way |
| `auth.socialProviders` | **always** — a login button is visible to any visitor anyway |
| `auth.passkey` (yes/no) | **always** |
| `auth.methods` (email/phone/username) | gated by **expose auth** (default OFF) |
| `auth.passwordPolicy` | gated by **expose auth** (default OFF) |

When **expose auth** is OFF (the default), the portal falls back to its
defaults: **email** login + a **minLength-3** password policy (matching the Hub
`PasswordComplexity` default). So the default posture reveals almost nothing
about a project's auth — only which socials/passkey exist (which the login
screen shows regardless).

### Social / passkey sign-in

A social button is just a link the backend owns:

```
{api}/auth/{provider}?projectId=pr_{base62}
{api}/auth/passkey?projectId=pr_{base62}
```

The portal only knows **that** a provider exists; all redirects, client IDs and
secrets live in the gateway.

## Why this is safe (and why it isn't "CORS")

The endpoint is public and **id-addressable**, so its response is world-readable
and harvestable at scale. That's acceptable **only because the shape is a
deliberate allow-list**: brand + the fact that socials/passkey exist, with the
sensitive auth detail opt-in. **CORS does not secure it** — CORS is browser-only
(controls which web origins may *read* a response in JS); `curl`/scripts ignore
it and the data left the server regardless. Safety = response shape, not CORS.

## The three ways a portal consumes this

1. **Developer passes config** (`VITE_ADMIN_CONFIG_MODE=static`) — brand + auth
   from a bundled `config/projects/{id}.json`. No endpoint call. Fork/fast path.
2. **Own deployment / fork** — change components/CSS directly.
3. **Call the Hub** (`dynamic`, default) — fetch this endpoint, merge over the
   neutral defaults. Expose-auth ON → accurate flow; OFF → defaults.

All three produce the same `ProjectConfig` shape consumed by the portal.

---

## Spec for the Cloud / Hub teams (to implement where it compiles)

The frontend is complete and verified against the response shape above. The
gateway endpoint (`Isidos.CodeMash.Services.Api/Heartbeat/PublicProjectConfig.cs`)
is written but depends on read-model fields that must be added:

### 1. Two settings flags (Hub membership settings, Cloud Access tab)

Add to the project's membership/authorization settings, surfaced in **Cloud →
Membership → Access** as two checkboxes, each with a docs link:

- **"Expose brand to admin portal"** — default **ON**.
- **"Expose auth settings to admin portal"** — default **OFF**. Docs explain
  it reveals identifier methods + password policy (not secrets), so the portal
  mirrors the real rules; otherwise defaults are used.

### 2. Read-model fields the endpoint reads (add to `ProjectDto`)

- `bool ExposeBrandToAdminPortal` (default true)
- `bool ExposeAuthToAdminPortal` (default false)
- `List<AuthenticationFlowSummaryDto> MembershipAuthenticationFlows` — a
  **public-safe projection** of `AuthenticationSettings.Flows`, with per-flow:
  - `Type` (the `FlowType` name, e.g. `"SocialLogin"`, `"EmailPasskey"`)
  - `Provider` (for `SocialLogin` flows: the provider id)
  - `PasswordComplexity` (for password flows: min/max counts + allowedSpecial)

  Project ONLY these public-safe fields — never integration ids, secrets,
  templates, SMS config, RP-IDs, etc.

### 3. Password-policy default

`PasswordComplexity.MinLength` default was changed `0 → 3` (domain). The portal
default mirrors `minLength: 3`. Keep them in sync.
