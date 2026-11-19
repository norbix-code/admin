// Root layout for the Next.js app-router portal. The design tokens + Tailwind
// live in src/styles.css; it is imported here so every page has the theme.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../src/styles.css';
import { portalSetup } from './lib/portalSetup';

// Per request (the catch-all page is force-dynamic), so PROJECT_ID is read
// from the RUNTIME server env, not baked in at build: one image works for any
// project. Written as <meta name="norbix-project">, which the browser reads
// (src/config/project.ts). Not set up → no tag (the page shows the setup
// screen, app/SetupRequired.tsx).
export function generateMetadata(): Metadata {
  const { projectId } = portalSetup();
  return {
    title: 'Admin Portal',
    ...(projectId ? { other: { 'norbix-project': projectId } } : {}),
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
