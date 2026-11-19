import { AuthLayout } from '@/components/layouts';
import { Alert } from '@/components/ui';
import { useAppSelector } from '@/app/hooks';
import { selectProjectBranding } from '@/features/project/slice';

// In a template preview or a test email there is no real recipient yet, so
// the footer links open these pages instead of the real ones.

const NOTICES = {
  preview:
    'You cannot view the email on the web while in preview mode. This link works in the email that is actually sent. Send a test email to yourself to check it.',
  preferences:
    'You cannot change email preferences in preview mode. Only the person who gets the real email can. Send a test email to yourself to check the link.',
  unsubscribe:
    'You cannot unsubscribe in preview mode. Only the person who gets the real email can. Send a test email to yourself to check the link.',
} as const;

export function PreviewModeNotice({ kind }: { kind: keyof typeof NOTICES }) {
  const branding = useAppSelector(selectProjectBranding);
  return (
    <AuthLayout brandName={branding?.displayName} logoUrl={branding?.logoUrl}>
      <Alert kind="info">{NOTICES[kind]}</Alert>
    </AuthLayout>
  );
}
