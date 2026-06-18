/** @type {import('tailwindcss').Config} */
// The Tailwind theme is mapped onto the CSS design tokens defined in
// src/styles.css (:root variables). This is what makes the open-source portal
// re-skinnable: a developer overrides the --admin-* variables in their own
// stylesheet and every utility class below follows — no component edits.
//
// Token-backed utilities exposed to components:
//   colors:  bg-brand / text-brand / brand-hover / brand-fg,
//            bg-surface, bg-app, text-fg / text-muted / text-subtle,
//            border-token, plus danger/success/error/info pairs
//   radius:  rounded-token / rounded-token-sm / rounded-token-lg
//   font:    font-sans (var-driven)
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--admin-primary)',
          hover: 'var(--admin-primary-hover)',
          fg: 'var(--admin-primary-fg)',
        },
        accent: 'var(--admin-accent)',
        app: 'var(--admin-bg)',
        surface: 'var(--admin-surface)',
        fg: {
          DEFAULT: 'var(--admin-fg)',
          muted: 'var(--admin-fg-muted)',
          subtle: 'var(--admin-fg-subtle)',
        },
        'border-token': 'var(--admin-border)',
        danger: {
          DEFAULT: 'var(--admin-danger)',
          fg: 'var(--admin-danger-fg)',
        },
        'success-bg': 'var(--admin-success-bg)',
        'success-fg': 'var(--admin-success-fg)',
        'error-bg': 'var(--admin-error-bg)',
        'error-fg': 'var(--admin-error-fg)',
        'info-bg': 'var(--admin-info-bg)',
        'info-fg': 'var(--admin-info-fg)',
      },
      borderRadius: {
        token: 'var(--admin-radius)',
        'token-sm': 'var(--admin-radius-sm)',
        'token-lg': 'var(--admin-radius-lg)',
      },
      fontFamily: {
        sans: ['var(--admin-font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
