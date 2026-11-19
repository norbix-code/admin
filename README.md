# Norbix Admin Portal

A ready-made portal for the **users of your Norbix project**. They create an
account or sign in, change their password and passkeys, edit their profile,
and choose which messages they get. It also shows your terms and privacy policy on a public
page.

This repository is a **starter**. You clone it and host it on your own address
(for example `admin.example.com`). Norbix does not host it for you.

It is open source (MIT). Change anything you like.

## Quick start

You need [Node.js](https://nodejs.org) 22.12 or newer and a Norbix project.

### 1. Get the code

```bash
git clone https://github.com/norbix-code/admin.git my-portal
cd my-portal
```

### 2. Get two values from Norbix Cloud

Open your project in Norbix Cloud and go to **Project Settings → Admin
Portal**.

1. Create (or assign) the **Admin Portal service user**.
2. Issue an **API key** for it. It is shown only once. Keep it secret.
3. The page shows a ready **`.env` file** with your project id and the key.
   Copy it.

### 3. Fill in `.env`

```bash
cp .env.example .env
```

Paste the file from Norbix Cloud, or set the two values yourself:

```bash
PROJECT_ID=pr_...
API_KEY=...
```

That is all the portal needs. The other settings are optional and explained in
`.env.example`.

### 4. Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3100>. You see the sign-in page of your project.

If you see **"This portal is not set up yet"**, the page tells you which value
is missing. Fix `.env` and start again.

### 5. Put it online

With Docker:

```bash
docker build -f deployments/Dockerfile -t my-portal .
docker run -p 3100:3100 -e PROJECT_ID=pr_... -e API_KEY=... my-portal
```

Or on any host with Node:

```bash
npm run build
PROJECT_ID=pr_... API_KEY=... npm run start
```

The portal listens on port `3100`. Point your address (for example
`admin.example.com`) at it and use https. More in
[`docs/devops.md`](./docs/devops.md).

### 6. Tell Norbix where your portal is

In Norbix Cloud, open **Project Settings → Brand** and save your portal's
address (for example `https://admin.example.com`) as **Admin portal URL**.

This does two things for you:

- It adds your address to the project's allowed origins (CORS), so sign-in
  works from your portal.
- E-mail links (password reset, invitation) point to your portal.

Done. Your users can sign in.

## What you can change

It is your copy, so everything. The usual things:

- **Colours, logo, fonts.** The portal takes your project's brand from Norbix
  Cloud. To go further, override the design tokens:
  [`docs/theming.md`](./docs/theming.md).
- **The sign-in page.** Which sign-in methods show up comes from your project
  settings: [`docs/login-resolution.md`](./docs/login-resolution.md). Social
  sign-in and the passkey recovery link:
  [`docs/social-sign-in.md`](./docs/social-sign-in.md).
- **Pages.** The screens are in `src/features/` and the routes in
  `src/App.tsx`. What each page does: [`docs/features.md`](./docs/features.md).
  To add a page: write the component in `src/features/<name>/`, add its path
  to `src/routes.ts`, its `<Route>` to `src/App.tsx`, and a menu entry in the
  sidebar (`src/components/layouts.tsx`).
- **Who may create an account.** The sign-up page (`/sign-up`) works when your
  project lets anyone sign up (Norbix Cloud → Membership → Authorization).
  Otherwise it shows the project's message, and people join by invitation.
- **Your own server code.** Add routes under `app/api/`. How the portal's
  backend works: [`docs/backend.md`](./docs/backend.md).

All docs: [`docs/`](./docs).

## Project layout

| Folder | What is in it |
| --- | --- |
| `app/` | The Next.js server: the page shell, the "not set up" page and the backend routes. |
| `app/api/proxy/` | The proxy the browser calls; it forwards to Norbix. |
| `app/api/bootstrap/` | Server-only data read with the API key. |
| `app/lib/` | Server helpers: settings check, project API address. |
| `src/features/` | The screens: `auth` (sign-in, sign-up, password, passkeys, invitation), `profile`, `preferences`, `legal`, `dashboard`. |
| `src/components/` | Shared UI: buttons, form fields, layouts, icons. |
| `src/services/` | Calls to Norbix through the SDK. |
| `src/config/` | Reading the project's public settings (brand, sign-in options). |
| `tests/e2e/` | Browser tests (Playwright) against a fake Norbix. |
| `docs/` | How things work, in more detail. |

## Settings

| Variable | Needed | What it is |
| --- | --- | --- |
| `PROJECT_ID` | yes | Your project's id (`pr_...`). |
| `API_KEY` | yes | The API key of the Admin Portal service user. |
| `ENV` | no | Project environment. Empty means PROD. Use `staging` or `test`. |
| `HUB_BASE_URL` | no | Default `https://hub.norbix.ai`. |
| `API_BASE_URL` | no | Default `https://api.norbix.ai`. |

The project is **only** the one in `PROJECT_ID`. The address people open the
portal at does not change it.

The API key stays on the server. The browser never gets it: the browser talks
only to the portal, and the portal talks to Norbix.

## Develop

```bash
npm run dev          # http://localhost:3100
npm test             # unit tests (vitest)
npm run typecheck    # tsc
npm run lint         # eslint
npm run format       # prettier
npm run build        # next build
npm run test:e2e     # browser tests against a fake Norbix (Playwright)
```

Built with Next.js 15 · React 19 · TypeScript · Redux Toolkit (RTK Query) ·
React Router 7 · Tailwind CSS 3. Data access uses the Norbix SDK
(`@norbix.ai/ts` and `@norbix.ai/react-redux`, wired in
`src/services/norbix.ts`). To try an SDK change before it is published, see
[`docs/sdk-local-development.md`](./docs/sdk-local-development.md).

**Few dependencies, on purpose.** UI primitives and icons are hand-written (no
component or icon library). Please don't add runtime dependencies without
discussion — see [`SECURITY.md`](./SECURITY.md).

## Quality & security tooling

- **CI** (`.github/workflows/ci.yml`): lint, format check, typecheck, tests,
  build, and `npm audit` on every PR.
- **CodeQL** static analysis and **Trivy** image scanning.
- **Dependabot** weekly updates for npm, GitHub Actions, and the Docker base.

## Licensing note for contributors

UI components here are **clean-room**: plain React + Tailwind CSS (MIT), no
component library. Do **not** paste markup from Tailwind UI / Catalyst (a paid
product) into this repository. See [`NOTICE`](./NOTICE).
