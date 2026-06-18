# Admin Portal — devops

Mirrors the **Cloud** image + k8s layout under `/norbix/devops`. The Admin
image is a static SPA served by nginx, exactly like Cloud.

## 1. Docker image

`admin/deployments/Dockerfile` (multi-stage, same shape as Cloud):

1. **build** — `node:22-alpine`, `npm ci`, `npm run build` (`tsc && vite
   build`). Build-time flags baked via Vite `define`:
   - `VITE_ADMIN_RELEASE` = `ManagedService` | `SelfHosted` | `Enterprise`
   - `VITE_ADMIN_API_BASE_URL`, `VITE_ADMIN_API_VERSION`
   - `VITE_ADMIN_PROJECT_ID` (optional; pins the project for custom-domain
     self-hosted builds)
2. **runtime** — `nginx:1.27-alpine`, serves `/dist`, runs as unprivileged
   `nginx` user, listens on `8080`, SPA fallback to `index.html`, `/healthz`.

Build examples:

```
docker build -t admin:managed     --build-arg VITE_ADMIN_RELEASE=ManagedService .
docker build -t admin:selfhosted  --build-arg VITE_ADMIN_RELEASE=SelfHosted \
                                   --build-arg VITE_ADMIN_PROJECT_ID=7Hk2 .
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
  ingress/admin.yaml                      # wildcard ingress for pr_*.admin
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
  `pr_7Hk2.admin.norbix.ai`. For TLS on the custom host we either (a) ask them
  to terminate TLS at their edge, or (b) issue a per-host cert via cert-manager
  for the custom domain and add an ingress rule. Because the CNAME target
  carries the project id, the SPA still resolves the project; for the custom
  host the ingress injects `X-Norbix-Project: 7Hk2` (annotation) so the SPA
  can read it when the visible host has no `pr_` prefix.

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
