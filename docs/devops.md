# Admin Portal — devops

Mirrors the **Cloud** image + k8s layout under `/norbix/devops`. The Admin
image is a static SPA served by nginx, exactly like Cloud.

## 1. Docker image

`admin/deployments/Dockerfile` (multi-stage, same shape as Cloud):

1. **build** — `node:22-alpine`, `npm ci`, `next build` (standalone output).
   Browser values are inlined at build time, so they are build args:
   - `NEXT_PUBLIC_ADMIN_PROJECT_ID` (optional; pins the project for
     self-hosted / custom-domain builds)
   - `NEXT_PUBLIC_ADMIN_CONFIG_MODE` (`dynamic` default, or `static`)
2. **runtime** — `node server.js` as an unprivileged user on `3100`. Server
   env at `docker run`: `API_KEY` (service-user key, self-hosted),
   `HUB_BASE_URL`, `API_BASE_URL`, `ENV`. Managed vs self-hosted comes from
   `/echo` and from whether `API_KEY` is set.

Build examples:

```
docker build -f deployments/Dockerfile -t admin:managed .
docker build -f deployments/Dockerfile -t admin:selfhosted \
  --build-arg NEXT_PUBLIC_ADMIN_PROJECT_ID=pr_5R4dlqJeXx943tOzSDEwbS .
```

`admin/deployments/nginx/default.conf` matches Cloud's: long cache on hashed
`/assets/`, no-cache on `index.html`, gzip, security headers, `/healthz`.

## 2. Kubernetes (under `devops/k8s`)

New files added alongside the existing `cloud.*`:

```
devops/k8s/
  config-maps/admin.yaml                  # non-secret VITE_ADMIN_* config
  secrets/admin.example.yaml              # template for any secret values
  deployments/managed-service/admin.yaml  # Deployment (managed)
  deployments/self-hosted/admin.yaml      # Deployment (self-hosted)
  services/managed-service/admin.yaml     # ClusterIP Service
  ingress/admin.yaml                      # wildcard ingress for pr-<hex>.admin
```

### ConfigMap (`norbix-admin-config`)

Non-secret runtime config: `VITE_ADMIN_RELEASE`, `VITE_ADMIN_API_BASE_URL`,
`VITE_ADMIN_API_VERSION`. **No** project id and **no** API key here — the
project comes from the subdomain, and end-user API keys are not a deploy
concern (same reasoning as Cloud's configmap).

### Deployment / Service

- `replicas: 2` for managed service (stateless SPA behind the ingress),
  `1` for self-hosted.
- container port `8080` (image runs unprivileged).
- readiness/liveness on `/healthz`.
- `envFrom: norbix-admin-config`.

### Wildcard ingress — the important part

Managed service serves **every** project from one deployment, so the ingress
matches the wildcard host `*.admin.norbix.ai`:

```
host: "*.admin.norbix.ai"   →  service: admin
```

- TLS: a **wildcard certificate** for `*.admin.norbix.ai` (cert-manager /
  ACME DNS-01, since HTTP-01 can't do wildcards). The bare `admin.norbix.ai`
  also routes to the same service (renders the blank placeholder).
- **Custom domains (CNAME):** the customer CNAMEs `admin.<their-domain>` to
  `pr-<32 hex>.admin.norbix.ai` (the project's host label). For TLS on the custom host we either (a) ask them
  to terminate TLS at their edge, or (b) issue a per-host cert via cert-manager
  for the custom domain and add an ingress rule. Because the CNAME target
  carries the project id, the SPA still resolves the project; for the custom
  host the portal asks the managed Hub (`/admin-portal-id?host=`) because the
  visible host has no `pr-` label.

### Secrets

The SPA itself needs no server secrets (it's static). `secrets/admin.example.yaml`
is a template kept for parity / future use (e.g. a build-time pin delivered via
secret, or basic-auth on a staging ingress). Documented in
`devops/k8s/SECRETS.md` style.

## 3. Apply order (self-hosted)

```
kubectl apply -f namespace/norbix.yaml
kubectl apply -k config-maps
kubectl apply -k deployments/self-hosted
kubectl apply -f ingress/admin.yaml
```

## 4. CI (later)

Mirror Cloud's buildx pipeline: multi-arch image, one build per flavor,
pushed to the same registry with tags `admin:community|managed|enterprise`.
Not built in this pass.
