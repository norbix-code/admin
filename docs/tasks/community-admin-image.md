# Task: community-admin image (self-hosted, public-safe)

Branch `feat/community-admin-image` (worktree `worktrees/admin/feat/community-admin-image`).
Not pushed, no PR, no image published.

## Goal
A clean, public-safe `community-admin` Docker image for the self-hosted edition:
no secrets / test files / source maps in it, and all customer config supplied at
runtime so one image works for any customer on any domain.

## Plan
1. Find whether Admin behaves differently per edition at build time.
2. Harden `.dockerignore`.
3. Make sure customer config (API URL, project id, API key) is runtime, not baked.
4. Verify (lint / format / typecheck / tests / next build / docker build + FS scan).

## Changes
- fix(docker): no edition build arg exists — removed the dead `VITE_ADMIN_RELEASE`
  build arg from `.github/workflows/staging.yml` and `docker-image.yml`; fixed the
  "admin has no self-hosted image" wording — done
- feat(docker): harden `.dockerignore` (env variants, keys, tests, artefacts,
  `.next`, editor/CI dirs, Vite-era files, docs) — done
- feat(docker): runtime `PROJECT_ID` → `<meta name="norbix-project">` emitted by
  `app/layout.tsx` (`generateMetadata`, per request), validated by
  `app/lib/runtimeProject.ts` (+ 4 unit tests) — done
- docs: Dockerfile header, `.env.example`, `src/config/project.ts` resolver
  comment — done

## Findings
1. Edition is decided at RUNTIME, never at build time — so the community image is
   the same build, tagged `community-admin`.
   ```ts
   // src/App.tsx
   isManaged = echo.release === 'ManagedService'; // <-- here: from the Hub's /echo
   ```
   ```ts
   // app/api/structure/route.ts
   //   API_KEY unset → managed     → call the PRIVATE internal endpoint  // <-- here: key presence = self-hosted
   ```
2. The staging/CI workflows passed a build arg nothing reads:
   ```yaml
   build-args: |
     VITE_ADMIN_RELEASE=${{ needs.plan.outputs.flavor }}   # <-- here: no ARG in Dockerfile, no reader in code
   ```
3. The project id was build-time only for self-hosted custom domains:
   ```ts
   // src/config/env.ts
   ? process.env.NEXT_PUBLIC_ADMIN_PROJECT_ID  // <-- here: inlined at `next build`
   ```
   Without it a self-hosted portal on `admin.customer.com` falls through to
   `resolveProjectIdByHost`, which calls the MANAGED hub (hub.norbix.ai) from the
   browser and gets 404 → "no project". Fixed with the runtime `PROJECT_ID`.
4. Server config is already runtime (read by the standalone Node server; all
   routes are `force-dynamic`): `API_KEY`, `HUB_BASE_URL`, `API_BASE_URL`,
   `HUB_VERSION`, `API_VERSION`, `ENV`.
5. Next loads `.env*` files at build and inlines `NEXT_PUBLIC_*` from them, so an
   `.env.production` / `.env.local` in the context would pin every user of a
   public image. `.dockerignore` now drops `.env` and `.env.*`.
6. `tsconfig.tsbuildinfo` is tracked in git and rewritten by every build (now
   excluded from the Docker context; untracking it is a separate cleanup).

## Rejected
- An edition build arg (e.g. `NEXT_PUBLIC_ADMIN_RELEASE`): no code would read it;
  the runtime /echo is the source of truth.
- Re-ordering the resolver so the meta tag beats the host label: not needed (a
  self-hosted domain never matches `pr-<32 hex>`), and it would touch managed.
- Adding a `staging-sh-*` → community-admin path to staging.yml: devops has no
  self-hosted staging target for admin yet (see Needs you).

## Needs you
- devops `k8s/deployments/self-hosted/admin.yaml` is stale for the Next image:
  `containerPort: 8080` + `/healthz` probes (image listens on 3100, no /healthz
  route — `/` works), image `norbix/admin:local` (should be
  `norbix/community-admin:<tag>`).
- devops `k8s/config-maps/admin.yaml` uses Vite-era names
  (`VITE_ADMIN_RELEASE`, `VITE_ADMIN_HUB_BASE_URL`, `VITE_ADMIN_API_BASE_URL`…)
  that the Next server does not read. Self-hosted needs `HUB_BASE_URL`,
  `API_BASE_URL`, `PROJECT_ID`, optional `ENV`, and `API_KEY` from a Secret.
- A publish job for `community-admin` (none exists in this repo).

## Open questions
- Should a self-hosted portal without `PROJECT_ID` skip the managed-hub
  custom-domain lookup (browser call to hub.norbix.ai)? Today it still tries.
