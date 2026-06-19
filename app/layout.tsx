// Root layout for the Next.js app-router portal. The design tokens + Tailwind
// live in the existing src/styles.css; it is imported here so the migrated
// screens keep the same theming. During the phased migration the actual UI is
// still served by the Vite app; this layout is the shell the ported screens
// will mount into.
import type { ReactNode } from 'react';
import '../src/styles.css';

export const metadata = {
  title: 'Admin Portal',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
