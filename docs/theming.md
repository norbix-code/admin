# Theming & extending the portal

The Admin Portal is open source (MIT) and built to be **re-skinned without
forking**. Styling flows entirely from **CSS design tokens** (custom
properties), and the interactive components are built on **Headless UI** for
accessibility. This page is for developers who install the portal and want it
to match their brand.

## Licensing — what we use

| Dependency | License | Notes |
| --- | --- | --- |
| Tailwind CSS | MIT | the utility framework |
| **Headless UI** (`@headlessui/react`) | **MIT** | accessible behavior primitives — free for production |
| Heroicons | — | not used; icons are inline SVGs in `src/components/icons.tsx` |

We do **not** use Tailwind UI / Catalyst (a paid, licensed product). Everything
shipped here is MIT, so you can use, modify, and redistribute it freely.

## How styling works

1. `src/styles.css` defines the tokens under `:root` (the `--admin-*` variables).
2. `tailwind.config.cjs` maps Tailwind's theme onto those tokens, exposing
   utilities like `bg-brand`, `text-fg`, `border-border-token`, `rounded-token`.
3. Components use only those token-backed utilities.

So **overriding a token restyles every component that uses it** — no component
edits.

## Re-skin in one file

Create your own stylesheet, import it **after** the portal's `styles.css`, and
override any tokens:

```css
/* my-theme.css */
:root {
  /* brand */
  --admin-primary: #7c3aed;        /* violet */
  --admin-primary-hover: #6d28d9;
  --admin-primary-fg: #ffffff;

  /* surfaces & text */
  --admin-bg: #0b0f19;             /* dark app background */
  --admin-surface: #131826;
  --admin-fg: #e6e8ee;
  --admin-fg-muted: #9aa3b2;
  --admin-fg-subtle: #6b7280;
  --admin-border: #232a3b;

  /* shape & type */
  --admin-radius: 0.75rem;         /* rounder corners */
  --admin-font-sans: 'Inter', system-ui, sans-serif;
}
```

That single file turns the portal dark-violet with rounder corners. No
component changes.

## Available tokens

| Token | Purpose |
| --- | --- |
| `--admin-primary` / `--admin-primary-hover` / `--admin-primary-fg` | brand / accent (buttons, links, active nav) |
| `--admin-bg` | app background |
| `--admin-surface` | cards, inputs, sidebar, menus, dialogs |
| `--admin-fg` / `--admin-fg-muted` / `--admin-fg-subtle` | text hierarchy |
| `--admin-border` | borders & dividers |
| `--admin-danger` / `--admin-danger-fg` | destructive actions |
| `--admin-success-bg/-fg`, `--admin-error-bg/-fg`, `--admin-info-bg/-fg` | alert states |
| `--admin-radius` / `--admin-radius-sm` / `--admin-radius-lg` | corner radius |
| `--admin-font-sans` | font family |

> The per-project **brand color** (`branding.primaryColor` from the login
> config) is applied at runtime by setting `--admin-primary`, so a tenant's
> color shows without any build step. Your theme file can still override the
> rest.

## Components

`src/components/ui.tsx` exposes token-styled, Headless-UI-backed primitives:

- `Button` (variants: primary / secondary / ghost / danger)
- `TextField`
- `Select` — Headless UI `Listbox`
- `Toggle` — Headless UI `Switch`
- `Modal` / `ConfirmDialog` — Headless UI `Dialog` (focus trap, ESC to close)
- `DropdownMenu` — Headless UI `Menu` (keyboard nav)
- `Card`, `PageHeader`, `Alert`, `Spinner`

Because they're built on Headless UI, accessibility (focus, keyboard, ARIA) is
handled for you. To add a new component, compose Headless UI primitives and
style them with the token utilities — keep the same approach so the theme stays
consistent.

## Extending with your own screens

The app is a standard Redux Toolkit + React Router SPA. Add a feature under
`src/features/<name>`, a route in `src/routes.ts`, a nav entry in
`src/components/layouts.tsx`, and reuse the `ui.tsx` primitives. Data access
goes through the Norbix SDK hooks (see `docs/sdk-local-development.md`).
