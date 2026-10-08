# Norbix Admin Portal — documentation

This folder documents the **Admin Portal** (the *end-user portal*): the
out-of-the-box, self-service portal that a Norbix project's **end users**
(the developer's customers) sign in to.

| Doc | What it covers |
| --- | --- |
| [`architecture.md`](./architecture.md) | The full picture: the four portals (Hub, API, Cloud, Admin), how Admin fits, the `pr-<hex>` host-label model, dynamic vs static login config, CNAME mapping, deployment flavors. |
| [`login-resolution.md`](./login-resolution.md) | How the unauthenticated login screen is built — dynamic (Hub) vs static (YAML/JSON) config, the resolution order, and caching. |
| [`features.md`](./features.md) | The four feature areas: Auth management, Profile / contact info, Communication preferences (rendered from Cloud's structure), Compliance / privacy (hidden until the gateway has it). Plus the planned "own records" feature. |
| [`implementation-plan.md`](./implementation-plan.md) | Phased build plan. What we reuse from Cloud, what we rewrite (clean-room), and the open-source licensing rules. |
| [`devops.md`](./devops.md) | Docker image, nginx, and Kubernetes manifests (managed-service + self-hosted), wildcard ingress for `pr-<hex>`. |

## One-paragraph summary

The Admin Portal is a single React SPA, open-source, served from
`admin.norbix.ai` (managed service) or `admin.<customer-domain>` (self-hosted
/ enterprise). It is **not** deployed per project. Instead the **project is
carried in the host label** — `pr-<32 hex>.admin.norbix.ai` (the gateway's
`ProjectId.HostLabel`). A bare
`admin.norbix.ai` with no project prefix renders a blank/placeholder page. The
portal resolves the project from the subdomain, asks the **API gateway** for
that project's public membership settings, and renders the correct login
screen (email/password, social logins, branding). Authenticated users manage
their **auth** (password, passkeys), **profile** (contact info) and
**communication preferences**; the public terms & policies pages need no
sign-in. Compliance (data export, account deletion) is hidden until the
gateway has its endpoints.
