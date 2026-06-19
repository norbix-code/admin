// Placeholder home route during the phased Vite → Next migration.
//
// The portal UI (login, profile, security, preferences, legal) is being ported
// from src/ (Vite) into the app/ router. Until that lands, this page documents
// the live BFF surface so the Next server is verifiably running.
//
// The BFF is already functional: GET /api/bootstrap?projectId=... returns
// brand + auth + the privileged roles & marketing-preference catalogs, fetched
// server-side with the service-user API key.
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold">Admin Portal</h1>
      <p className="mt-3 text-sm text-fg-muted">
        Backend-for-frontend is running. UI migration from Vite to the Next.js
        app router is in progress.
      </p>
      <p className="mt-4 text-sm text-fg-subtle">
        BFF: <code>GET /api/bootstrap?projectId=…</code>
      </p>
    </main>
  );
}
