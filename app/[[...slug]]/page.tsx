// Optional catch-all: every non-/api path renders the SPA client shell, which
// hands routing to react-router (BrowserRouter) on the client. API route
// handlers (app/api/*) take precedence over this page, so the BFF stays
// reachable. As screens are ported to native Next routes, add them as explicit
// app/ routes — they win over this catch-all.
import SpaShell from '../SpaShell';

// The SPA owns its routes at runtime; we don't statically enumerate them.
export const dynamic = 'force-dynamic';

export default function CatchAllPage() {
  return <SpaShell />;
}
