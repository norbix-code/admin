import { Link } from 'react-router-dom';
import { skipToken } from '@reduxjs/toolkit/query';
import { PageHeader, Card } from '@/components/ui';
import { useAppSelector } from '@/app/hooks';
import { selectSelectedProjectId } from '@/features/project/slice';
import { useGetStructureQuery } from '@/services/portalApi';
import { navCardsFromStructure } from '@/config/structure';

export function Dashboard() {
  const projectId = useAppSelector(selectSelectedProjectId);
  // RTK Query owns the fetch + cache. `skipToken` until a project is resolved.
  // While loading (or on error) `data` is undefined → the default layout shows.
  // (The backend picks self-hosted vs managed from API_KEY presence.)
  const { data: structure } = useGetStructureQuery(
    projectId ? { projectId } : skipToken,
  );
  const cards = navCardsFromStructure(structure);

  return (
    <>
      <PageHeader
        title="Your account"
        subtitle="Manage your account settings."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to}>
            <Card className="h-full transition hover:shadow-md">
              <h3 className="text-base font-medium text-fg">{c.title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{c.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

export function Placeholder() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-app px-4 text-center">
      <h1 className="text-xl font-semibold text-fg">Norbix Admin</h1>
      <p className="mt-2 max-w-sm text-sm text-fg-muted">
        No project selected. Open this portal at your project address (for
        example <code>pr_xxxx.admin.norbix.ai</code>) to continue.
      </p>
    </div>
  );
}
