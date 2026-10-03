// Next.js config — single self-hostable Docker image, no Vercel dependency.
//
// `output: 'standalone'` emits a minimal self-contained Node server (.next/
// standalone) that serves BOTH the React UI and the BFF route handlers
// (app/api/*) from one process — so the whole portal ships as ONE container.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Dev only. When the dev server is reached under another host name (the
  // Docker stack serves it as admin.<item>.norbix.test), the HMR socket's
  // Origin is that host: Next 15 warns, Next 16 blocks. ADMIN_DEV_ORIGINS is
  // a comma-separated list of host names; unset = Next's default (localhost).
  ...(process.env.ADMIN_DEV_ORIGINS
    ? {
        allowedDevOrigins: process.env.ADMIN_DEV_ORIGINS.split(',')
          .map((h) => h.trim())
          .filter(Boolean),
      }
    : {}),
  eslint: {
    // Lint is run separately in CI; don't fail the production build on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
