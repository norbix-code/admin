// Root layout for the Next.js app-router portal. The design tokens + Tailwind
// live in the existing src/styles.css; it is imported here so the migrated
// screens keep the same theming. During the phased migration the actual UI is
// still served by the Vite app; this layout is the shell the ported screens
// will mount into.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../src/styles.css';
import { runtimeProjectId } from './lib/runtimeProject';

// Per request (the catch-all page is force-dynamic), so PROJECT_ID is read
// from the RUNTIME server env, not baked in at build: one public image works
// for any self-hosted customer. Emitted as <meta name="norbix-project">, which
// the client resolver reads (src/config/project.ts). Unset → no tag, and the
// project comes from the host label as before (managed).
export function generateMetadata(): Metadata {
  const projectId = runtimeProjectId(process.env.PROJECT_ID);
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
