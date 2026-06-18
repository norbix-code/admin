import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// ── Local SDK resolution ────────────────────────────────────────────
// `@norbix/react-redux` is developed in the sibling monorepo checkout and is
// NOT published to npm yet, and it ships no prebuilt dist/. So we always
// resolve it to its TypeScript SOURCE — Vite transforms it and HMR fires on
// every edit. No build, no publish, no version bump, no reinstall.
//
//   norbix/
//     admin/                 ← this app
//     sdks/
//       norbix-react-redux/  ← aliased to its src/index.ts (always)
//       norbix-js/           ← @norbix.ai/ts; has a built dist/, resolved normally
//
// Set NORBIX_LINK=1 (npm run dev:link) to ALSO resolve the core SDK
// (@norbix.ai/ts) to its local source, e.g. when changing the SDK too.
const resolvePath = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

const libSrc = resolvePath('../sdks/norbix-react-redux/src/index.ts');
const sdkDir = resolvePath('../sdks/norbix-js');

const linkSdkSource = process.env.NORBIX_LINK === '1';

const alias: Record<string, string> = { '@': '/src' };

// Always resolve the lib to source (it has no published artifact / dist).
if (existsSync(libSrc)) {
  alias['@norbix/react-redux'] = libSrc;
  // The lib imports the core SDK as 'norbix'; point it at the local SDK.
  alias['norbix'] = sdkDir;
}

// Optionally resolve the core SDK to its local checkout too.
if (linkSdkSource && existsSync(sdkDir)) {
  alias['@norbix.ai/ts'] = sdkDir;
}

export default defineConfig({
  resolve: { alias },
  // The local lib is ESM TS source; let Vite transform it (don't pre-bundle).
  optimizeDeps: existsSync(libSrc)
    ? { exclude: ['@norbix/react-redux', 'norbix', '@norbix.ai/ts'] }
    : undefined,
  css: { devSourcemap: true },
  plugins: [react()],
});
