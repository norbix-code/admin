// Next.js config.
//
// The Docker image sets NEXT_OUTPUT=standalone: Next then emits a small
// self-contained Node server (.next/standalone) that serves both the UI and
// the route handlers in app/api. Without it `npm run build` + `npm run start`
// run the normal Next server.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  reactStrictMode: true,
  // Dev only. When you open the dev server under a host name other than
  // localhost, list the host names in ADMIN_DEV_ORIGINS (comma-separated) so
  // hot reload keeps working.
  ...(process.env.ADMIN_DEV_ORIGINS
    ? {
        allowedDevOrigins: process.env.ADMIN_DEV_ORIGINS.split(',')
          .map((h) => h.trim())
          .filter(Boolean),
      }
    : {}),
  eslint: {
    // Lint runs on its own (`npm run lint`), not inside the build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
