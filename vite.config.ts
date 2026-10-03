import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// ── SDK resolution ──────────────────────────────────────────────────
// `@norbix.ai/ts` and `@norbix.ai/react-redux` come from npm. Set
// NORBIX_LINK=1 (npm run _vite:dev:link) to resolve both to the TypeScript
// source of the sibling monorepo checkouts instead, e.g. while changing an SDK:
//
//   norbix/
//     admin/                 ← this app
//     sdks/
//       norbix-react-redux/  ← @norbix.ai/react-redux
//       norbix-js/           ← @norbix.ai/ts
const resolvePath = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

const libSrc = resolvePath('../sdks/norbix-react-redux/src/index.ts');
const sdkSrc = resolvePath('../sdks/norbix-js/src/index.ts');

const linkSdkSource = process.env.NORBIX_LINK === '1' && existsSync(libSrc) && existsSync(sdkSrc);

const alias: Record<string, string> = { '@': '/src' };

if (linkSdkSource) {
  alias['@norbix.ai/react-redux'] = libSrc;
  alias['@norbix.ai/ts'] = sdkSrc;
}

export default defineConfig({
  resolve: { alias },
  // The linked SDKs are ESM TS source; let Vite transform them (don't pre-bundle).
  optimizeDeps: linkSdkSource
    ? { exclude: ['@norbix.ai/react-redux', '@norbix.ai/ts'] }
    : undefined,
  css: { devSourcemap: true },
  plugins: [react()],
});
