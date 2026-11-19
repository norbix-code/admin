// Optional catch-all: every non-/api path renders the SPA client shell, which
// hands routing to react-router (BrowserRouter) on the client. API route
// handlers (app/api/*) take precedence over this page.
//
// While PROJECT_ID or API_KEY is missing, every path shows the setup screen
// instead of the app.
import SpaShell from '../SpaShell';
import SetupRequired from '../SetupRequired';
import { portalSetup } from '../lib/portalSetup';

// The SPA owns its routes at runtime; we don't statically enumerate them. Also
// what makes the setup check run per request, against the runtime environment.
export const dynamic = 'force-dynamic';

export default function CatchAllPage() {
  const { problems } = portalSetup();
  if (problems.length > 0) return <SetupRequired problems={problems} />;
  return <SpaShell />;
}
