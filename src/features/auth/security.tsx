import { FormEvent, useState } from 'react';
import { PageHeader, Card, Button, TextField, Alert, Spinner } from '@/components/ui';
import { useChangePasswordMutation } from '@/services/norbix';
import { PasskeysCard } from './passkeys';

export function SecurityOverview() {
  return (
    <>
      <PageHeader title="Security" subtitle="Manage your password and passkeys." />
      <div className="flex flex-col gap-6">
        <ChangePasswordCard />
        <PasskeysCard />
      </div>
    </>
  );
}

function ChangePasswordCard() {
  const [change, { isLoading, isSuccess, isError }] = useChangePasswordMutation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    change({ currentPassword, newPassword });
  };

  return (
    <Card>
      <h3 className="mb-4 text-lg font-medium">Change password</h3>
      {isSuccess && <Alert kind="success">Password changed.</Alert>}
      {isError && <Alert kind="error">Could not change password.</Alert>}
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <TextField
          type="password"
          label="Current password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <TextField
          type="password"
          label="New password"
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Spinner /> : 'Update password'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
