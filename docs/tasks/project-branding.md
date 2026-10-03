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
2. feat(admin:branding): `AppLayout` sidebar header shows the logo (alt = name) or the project name; every `AuthLayout` use passes `brandName` + `logoUrl` from the store; `Placeholder` keeps "Norbix Admin" (no project is known there — see Findings) — todo
3. feat(admin:branding): `applyBranding` sets `document.title` to the project name; static metadata `Admin Portal` stays as the pre-load fallback — todo
4. test(admin:branding): vitest — `loadDynamicConfig` mapping (name fallback order, branding absent / present), `applyBranding` (title, favicon, CSS variables) — todo
5. test(admin:branding): fake host returns a branding block with a logo the fake host serves itself; `tests/e2e/branding.spec.ts` + goldens — todo
6. chore(admin:branding): typecheck, lint, format:check, vitest, Playwright fake-host suite all green; push; pull request — todo

## Changes

| file | what changed | plan step # |
|------|--------------|-------------|
| `docs/tasks/project-branding.md` | this file | 1 |

## Findings

## Rejected / moved out

## Needs you

## Open questions

None.
