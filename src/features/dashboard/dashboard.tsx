import { Link } from 'react-router-dom';
import { PageHeader, Card } from '@/components/ui';
import { ROUTES } from '@/routes';

const CARDS = [
  {
    to: ROUTES.PROFILE,
    title: 'Profile',
    desc: 'Update your contact information.',
  },
  {
    to: ROUTES.SECURITY,
    title: 'Security',
    desc: 'Password and two-factor authentication.',
  },
  {
    to: ROUTES.PREFERENCES,
    title: 'Preferences',
    desc: 'Choose which messages you receive.',
  },
  {
    to: ROUTES.PRIVACY,
    title: 'Privacy & data',
    desc: 'Export or delete your data.',
  },
];

export function Dashboard() {
  return (
    <>
      <PageHeader
        title="Your account"
        subtitle="Manage your account settings."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
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
