import { useState } from 'react';
import {
  PageHeader,
  Card,
  Button,
  Alert,
  Spinner,
  ConfirmDialog,
} from '@/components/ui';
import {
  useGetComplianceInfoQuery,
  useRequestDataExportMutation,
  useRequestAccountDeletionMutation,
} from '@/services/complianceService';

export function Privacy() {
  const { data, isLoading } = useGetComplianceInfoQuery();
  const [requestExport, { isLoading: exporting, isSuccess: exportRequested }] =
    useRequestDataExportMutation();
  const [requestDeletion, { isSuccess: deletionRequested }] =
    useRequestAccountDeletionMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Privacy & data"
        subtitle="Your data rights for this account."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <h3 className="mb-2 text-lg font-medium">Data we hold</h3>
          {isLoading ? (
            <Spinner label="Loading…" />
          ) : (
            <ul className="list-disc pl-5 text-sm text-fg-muted">
              {(data?.dataCategories ?? []).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 text-lg font-medium">Export my data</h3>
          {exportRequested || data?.exportStatus === 'requested' ? (
            <Alert kind="info">
              Your export is being prepared. You'll be notified when it's ready.
            </Alert>
          ) : data?.exportStatus === 'ready' && data.exportUrl ? (
            <a href={data.exportUrl} className="text-brand hover:underline">
              Download your data
            </a>
          ) : (
            <Button onClick={() => requestExport()} disabled={exporting}>
              {exporting ? <Spinner /> : 'Request data export'}
            </Button>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 text-lg font-medium">Delete my account</h3>
          {deletionRequested ? (
            <Alert kind="success">
              Account deletion requested. Check your email to confirm.
            </Alert>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-fg-muted">
                This will request permanent removal of your account and data.
              </p>
              <div>
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                  Request account deletion
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          requestDeletion({ confirm: true });
          setDeleteOpen(false);
        }}
        title="Delete your account?"
        body="This requests permanent removal of your account and all associated data. This cannot be undone."
        confirmLabel="Yes, delete my account"
        danger
      />
    </>
  );
}
