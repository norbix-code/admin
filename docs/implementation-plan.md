# Admin Portal — implementation plan

Goal: build the Admin Portal in `/norbix/admin`, **reusing the proven
techniques** from Cloud while keeping the result safe to **open source**.

## 1. What we reuse from Cloud (techniques, not 1:1 copies)

| Area | Reuse | Note |
| --- | --- | --- |
| Build | Vite + React 18 + TS, `@` → `/src` alias, SWC plugin | Copy `vite.config.ts` (trimmed: no Storybook/vitest browser stuff for v1). |
| State | Redux Toolkit, `configureStore`, feature **slices**, typed `useAppSelector/useAppDispatch` hooks | Same pattern as Cloud's `src/app/store.ts` + `src/app/hooks`. |
| Data fetching | RTK Query services that call the gateway | Cloud has `services/hub` + `services/api`. Admin keeps **only `services/api`** (end-user data plane) + a tiny **public** service for login config & legal docs. |
| SDK | `@norbix/react-redux` (RTK Query over the typed Norbix TS SDK) | Use its API-side hooks where they exist instead of hand-writing services. |
| Styling | Tailwind CSS + the project color tokens | Copy `tailwind.config.cjs` color palette + `postcss.config.cjs`. |
| Routing | `react-router-dom`, central `routes.ts` constants | Smaller route map (see `features.md`). |
| Layouts | The *structure* of `authLayout` / content layout, menu, shell | **Rewritten** clean-room (see §3). |

## 2. What we do NOT copy

- **Hub services** — Admin never calls Hub. Drop `services/hub/**`.
- The big feature set (modules, integrations, triggers, schemas, templates,
  payments, scheduler, logs, ...). Admin only has auth/profile/preferences/
  compliance.
- **Storybook / Chromatic / vitest-browser** tooling — out of scope for v1
  (can be added later). Keeps the dependency surface small.
- Paid component markup (see §3).

## 3. Open-source licensing — clean-room components

Cloud's form/list/button/layout components are built on **Tailwind UI /
Catalyst**, which is a **paid, licensed** product. We must **not** copy that
markup 1:1 into an open-source repo.

Rule:

- We keep using **Tailwind CSS** itself (MIT) freely.
- We build **our own** components — forms, fields, lists, buttons, layouts,
  modals, icons — from scratch with **plain React + Tailwind only**. To keep
  the dependency surface minimal (a security goal), we intentionally do **not**
  pull in a UI-component library, an icon library, a form library, or a
  className helper:
  - forms use native React `useState` + `onSubmit` (no react-final-form).
  - icons are a few hand-drawn inline SVGs in `src/components/icons.tsx`.
  - a 3-line local `cx()` replaces `clsx`.
  - the toggle is a plain `role="switch"` button (no Headless UI).
- Components may be **structurally similar** (a labeled text field is a
  labeled text field) but the markup, class composition, and styling are
  original. No copy-paste from Tailwind UI source.
- A short `NOTICE` / `README` note records this so contributors keep the rule.

### Minimal dependency policy

Runtime deps are limited to: `react`, `react-dom`, `@reduxjs/toolkit`,
`react-redux`, `react-router-dom`, `redux-persist`. Newest major versions
(React 19, Vite 7, RTK 2.12, React Router 7). Adding a runtime dependency
requires justification — see `SECURITY.md`.

Component inventory to build clean-room (under `src/components`):
`Button`, `TextField`, `PasswordField`, `Toggle`/`Switch`, `Select`,
`Card`, `FormRow`, `Alert`, `Modal`, `Spinner`, `PageHeader`, `EmptyState`,
`SocialButton`, and the two layouts (`AuthLayout`, `AppLayout` with sidebar
nav).

## 4. Project structure

```
admin/
  docs/                      # this folder
  public/
  src/
    app/
      store.ts               # configureStore + reducers + middleware
      hooks.ts               # typed useAppDispatch / useAppSelector
    config/
      env.ts                 # reads VITE_ADMIN_* envs
      project.ts             # resolve projectId from host / build pin
      loginConfig.ts         # static-then-dynamic loader (LoginConfig)
    components/              # clean-room UI (see §3)
    features/
      auth/                  # slice + login + reset + 2FA + requireAuth
      profile/               # slice + screen
      preferences/           # slice + screen (marketing prefs)
      compliance/            # slice + screens (export/delete/legal)
      _shared/               # alerts/toaster, small helpers
    services/
      api/                   # RTK Query: auth, profile, preferences, compliance
      public/                # RTK Query: login-config, legal docs (no auth)
      index.ts
    types/
      loginConfig.ts
      user.ts
      api.dtos.ts            # (placeholder; real ones come from the SDK/generator)
    routes.ts
    App.tsx
    main.tsx
    styles.css
  config/
    login-config.schema.json # JSON schema for static project config
    projects/                # static per-project configs (self-hosted)
      example.json
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.cjs
  postcss.config.cjs
  .env.example
```

## 5. Phases

**Phase 0 — scaffold (this pass).**
Vite/TS/Tailwind/RTK wiring, project-id resolution, login-config loader
(static+dynamic), clean-room components, the four feature slices + services
with screens, route map, `requireAuth` guard, build green.

**Phase 1 — wire to real API.**
Replace placeholder DTOs with the generated Norbix API DTOs / `@norbix/
react-redux` hooks. Confirm endpoint shapes against the gateway. Real OAuth
callback handling.

**Phase 2 — polish.**
2FA QR rendering, data-export status polling, account-deletion grace flow,
branding theming via `primaryColor`, i18n.

**Phase 3 — own records.**
End-user record browser with permission-gated CRUD over the API data plane.

**Phase 4 — tooling.**
Storybook for the clean-room components, unit tests (vitest) for the
login-config resolver and slices, e2e smoke.

## 6. Definition of done (per phase)

- `npm run build` passes (runs `tsc` then `vite build`) — typecheck is a gate.
- New logic (config resolver, slices) has meaningful tests asserting concrete
  values (matches the repo-wide test-quality rule: assert behavior + exact
  values, no `expect(x).to.exist`-only tests).
