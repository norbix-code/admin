// Next.js config — single self-hostable Docker image, no Vercel dependency.
//
// `output: 'standalone'` emits a minimal self-contained Node server (.next/
// standalone) that serves BOTH the React UI and the BFF route handlers
// (app/api/*) from one process — so the whole portal ships as ONE container.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // The SDK is consumed from source in the monorepo dev loop; transpile it so
  // Next compiles its TS rather than expecting a prebuilt dist.
  transpilePackages: ['@norbix.ai/ts', '@norbix/react-redux'],
  eslint: {
    // Lint is run separately in CI; don't fail the production build on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
