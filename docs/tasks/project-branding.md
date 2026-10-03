# Project branding — the Admin Portal shows the project's name and logo

Item C of the Norbix "Project" coverage campaign. Branch `audit/project-branding`
(admin repo, from `origin/main`).

## Goal

The portal shell, every sign-in screen and the browser tab show the project's
name and logo (from the gateway's public config) instead of "Account",
"Norbix" or "Admin Portal".

Not in scope: new branding fields on the gateway, dark mode, a mobile header
(the portal has none today — see Findings), the colour tokens (already applied).

## Plan

1. docs(admin:branding): this task file — done
2. feat(admin:branding): `AppLayout` sidebar header shows the logo (alt = project name) or the project name; every `AuthLayout` use passes `brandName` + `logoUrl` from the store — done, `src/components/layouts.tsx`, `src/features/auth/passwordReset.tsx`, `src/features/auth/callback.tsx`. Committed together with step 3 as `[2-3]` (one shared helper `projectNameOf` in `projectConfig.ts`).
3. feat(admin:branding): `applyBranding` sets `document.title` to the project name; the static metadata `Admin Portal` stays as the pre-load fallback — done, `src/config/projectConfig.ts`
4. test(admin:branding): vitest — public-config mapping (name fallback order, branding absent / present, empty logo, endpoint fails), `projectNameOf`, `applyBranding` (title, favicon, CSS variables) — done, `src/config/projectConfig.branding.test.ts` (12 tests)
5. test(admin:branding): fake host serves its own SVG logo and returns a `branding` block (logo + icon, no colours); `tests/e2e/branding.spec.ts` (3 tests) + goldens `branding-sign-in` and `branding-shell` (`-chromium-darwin`) — done
6. chore(admin:branding): checks green, push, pull request — done (results below)
7. feat(admin:branding): `dashboard.tsx:42` "Norbix Admin" → project name — dropped: that line is the `Placeholder` shown only when NO project resolved, so there is no name to show (see Rejected)

### Results (step 6)

- `npm run lint` — pass
- `npm run format:check` — pass
- `npm test` (vitest) — 13 files, 92 tests pass
- `npm run test:e2e` (fake host) — 6 / 6 pass (3 branding + 3 chat); the chat goldens did NOT change (the chat screenshots cover only the chat region, and the fake brand has no colours)
- `npm run typecheck` — 6 errors, all inside `../sdks/norbix-react-redux` and the same 6 on `origin/main` without this change (see Findings). Zero errors in `src/`.

### Local setup (not committed)

`package.json` and `tsconfig*.json` point at `../sdks/…`. From this worktree that is
`worktrees/admin/audit/project/sdks`, so a scratch symlink was made OUTSIDE the
repo: `ln -s ~/Projects/norbix/sdks ~/Projects/norbix/worktrees/admin/audit/project/sdks`,
then `npm ci`. No change to the SDK link paths. Logs: `~/scratch/project-branding/`.

## Changes

| file | what changed | plan step # |
|------|--------------|-------------|
| `docs/tasks/project-branding.md` | this file | 1, 6 |
| `src/config/projectConfig.ts` | `PLACEHOLDER_DISPLAY_NAME` + `projectNameOf()` (name, or undefined for the "Sign in" placeholder); `applyBranding` sets `document.title` | 2, 3 |
| `src/components/layouts.tsx` | `AppLayout` sidebar header: logo `<img alt=name>` or the name; "Account" only when no name; `data-testid="sidebar-brand"` | 2 |
| `src/features/auth/passwordReset.tsx` | both screens pass `brandName` + `logoUrl` from `selectProjectBranding` | 2 |
| `src/features/auth/callback.tsx` | passes `brandName` + `logoUrl` from the store | 2 |
| `src/config/projectConfig.branding.test.ts` | new vitest file (jsdom), 12 tests | 4 |
| `tests/e2e/fake-api-host.mjs` | serves `/__assets/logo.svg`; config gets `branding { displayName, logoUrl, iconUrl }` | 5 |
| `tests/e2e/branding.spec.ts` | new: sign-in, password reset, signed-in shell; tab title; favicon | 5 |
| `tests/e2e/branding.spec.ts-snapshots/branding-{sign-in,shell}-chromium-darwin.png` | new goldens | 5 |

## Findings

- fix(sdks:react-redux): the local SDK `main` checkouts do not typecheck together — `norbix-react-redux` calls `getEmailCampaignMessage` / `getSmsCampaignMessage` / `getPushCampaignMessage`, which `norbix-js` `main` (b7230dc) does not have — open, `sdks/norbix-react-redux/src/hooks/hub/notifications.ts:63`. `npm run typecheck` in admin fails with these 6 errors on `origin/main` too.
  ```ts
  type GetEmailCampaignMessage = Norbix['hub']['notifications']['getEmailCampaignMessage']; // <-- here: not on NotificationsModule (only …Messages)
  ```
- chore(admin:ci): CI never runs the Playwright suite, so the `-darwin` goldens are only checked on a Mac — open, `.github/workflows/ci.yml` (steps: lint, format, typecheck, test, build; no `test:e2e`). If e2e is added on `ubuntu-latest`, `-linux` goldens are needed.
- chore(admin:ci): CI checks out only the admin repo, yet `package.json` links `file:../sdks/norbix-js` — open, not checked here how `npm ci` resolves it on GitHub.
  ```json
  "@norbix.ai/ts": "file:../sdks/norbix-js", // <-- here: no ../sdks on the CI runner
  ```
- fix(admin:branding): the placeholder name is a page label ("Sign in"), so a project with no name shows "Sign in to Sign in" on the login heading — open, `src/features/auth/login.tsx:98` + `src/config/projectConfig.ts` `PLACEHOLDER_DISPLAY_NAME`. The new sidebar and tab title avoid it via `projectNameOf`; the login heading was left as it was (out of scope).
  ```tsx
  Sign in to {config.branding.displayName} {/* <-- here: "Sign in to Sign in" when the project has no name */}
  ```
- note(admin:layout): the task brief mentioned a mobile header at `layouts.tsx:~103` — there is none. That line is the "Account" label of the sign-out menu at the bottom of the sidebar; kept as is (it is the user's account menu, not the brand) — `src/components/layouts.tsx:120`.
- note(admin:layout): the sidebar is a fixed `w-60` column with no small-screen variant — open, `src/components/layouts.tsx` `<aside className="flex w-60 …">`.
- note(admin:branding): no component test for the name-only sidebar (brand exposed without logo); covered only through `projectNameOf` unit tests and the e2e logo case — open.
- note(admin:branding): the brand colours are not part of any golden (the fake brand has none, to keep the chat goldens stable) — open; a separate golden with `mainColor` would cover the token mapping visually.

## Rejected / moved out

- `dashboard.tsx:42` "Norbix Admin" stays: it is the `Placeholder` shown when no project was resolved, so no project name exists there. The signed-in home heading "Your account" was left unchanged.
- Tab title format: plain `<Project name>` (not `<Project name> · Account`) — shorter, and it reads well for every route.

## Needs you

- [ ] Review and merge the pull request (not merged by the agent).
- [ ] Decide on the Findings (SDK typecheck mismatch, e2e in CI / linux goldens, "Sign in to Sign in").

## Open questions

None.
