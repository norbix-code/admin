# Admin Portal — devops

The portal is one Next.js Node server (UI + the `/api/*` backend routes) on
port `3100`. You host it. It needs two values, `PROJECT_ID` and `API_KEY`
([`backend.md`](./backend.md), "Configuration").

## 1. Docker image

`deployments/Dockerfile` (multi-stage):

1. **build** — `node:22-alpine`, `npm ci`, `next build` with the standalone
   output (`NEXT_OUTPUT=standalone`). No build args.
2. **runtime** — `node server.js` as an unprivileged user on `3100`.

```bash
docker build -f deployments/Dockerfile -t my-admin-portal .
docker run -p 3100:3100 \
  -e PROJECT_ID=pr_5R4dlqJeXx943tOzSDEwbS \
  -e API_KEY=... \
  my-admin-portal
```

Everything else is read at run time, so the same image works for any project:

| Variable | Required | Default |
| --- | --- | --- |
| `PROJECT_ID` | yes | — |
| `API_KEY` | yes | — |
| `ENV` | no | PROD (set `staging` or `test` for that project environment) |
| `HUB_BASE_URL` | no | `https://hub.norbix.ai` |
| `API_BASE_URL` | no | `https://api.norbix.ai` |
| `HUB_VERSION` / `API_VERSION` | no | `v3` |

Keep `API_KEY` in your platform's secret store, not in the image and not in
git.

## 2. Without Docker

Any host with Node ≥ 22.12:

```bash
npm ci
npm run build
PROJECT_ID=pr_... API_KEY=... npm run start     # http://localhost:3100
```

## 3. In front of it

- **Your address and TLS.** Point your name (for example `admin.example.com`)
  at the portal and terminate https at your load balancer or reverse proxy.
  Social sign-in needs https (plain http works only on `localhost`).
- **Tell the project.** Save that address in Norbix Cloud as the project's
  "Admin portal URL" (README, step 6). Without it social sign-in refuses
  the portal's address and e-mail links do not point to your portal.
- **Server-sent events.** The proxy passes an event stream through as it is
  written and sends `X-Accel-Buffering: no`; do not add response buffering
  or compression for `text/event-stream` in your proxy.
- **Outgoing calls.** The portal must reach `HUB_BASE_URL`, `API_BASE_URL`
  and, for a project with its own API host, `pr-<32 hex>.api.<domain>` (same
  domain as `API_BASE_URL`) over https.

## 4. Health

- The image has a `HEALTHCHECK` on `GET /`. It answers `200` as soon as the
  server is up.
- A portal that is **not set up** also answers `200` on `/` — with the setup
  screen. To check the setup, call `GET /api/bootstrap`: `503` with
  `"error": "portal-not-set-up"` and the missing variable while it is not set
  up, `200` when it is. The server log has one line starting with
  `[admin-portal] Not set up:`.

## 5. CI in this repository

`.github/workflows/ci.yml` runs lint, format check, typecheck, tests, build
and `npm audit` on every pull request.
