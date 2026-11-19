// @vitest-environment jsdom
// The unsubscribe page behind an email's footer link: opening it changes
// nothing (mail scanners open links on their own); a click unsubscribes with
// the signed hash from the address.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import auth from '@/features/auth/slice';
import config from '@/config/slice';
import project from '@/features/project/slice';

const gateway = vi.hoisted(() => ({
  reads: [] as unknown[],
  unsubscribes: [] as unknown[],
  item: { emailAddress: 'ana@example.com', unsubscribedFromMarketing: false },
}));

vi.mock('@/services/hub', () => ({
  useGetEmailPreferencesByLinkQuery: (arg: unknown) => {
    gateway.reads.push(arg);
    return { isLoading: false, data: { item: gateway.item }, refetch: vi.fn() };
  },
  useOneClickUnsubscribeMutation: () => [
    (arg: unknown) => {
      gateway.unsubscribes.push(arg);
      return Promise.resolve({ data: {} });
    },
    { isLoading: false },
  ],
}));

const { EmailUnsubscribePage } = await import('./emailLinkPages');

const open = (entry: string) =>
  render(
    <Provider
      store={configureStore({
        reducer: combineReducers({ auth, config, project }),
      })}
    >
      <MemoryRouter initialEntries={[entry]}>
        <EmailUnsubscribePage />
      </MemoryRouter>
    </Provider>,
  );

afterEach(() => {
  cleanup();
  gateway.reads = [];
  gateway.unsubscribes = [];
});

describe('EmailUnsubscribePage', () => {
  it('reads with the hash, unsubscribes only on a click', async () => {
    open('/notifications/email-unsubscribe?hash=signed%2Bkey');

    expect(
      screen.getByText('ana@example.com receives marketing emails.'),
    ).toBeTruthy();
    expect(gateway.unsubscribes).toEqual([]);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Unsubscribe from all marketing emails',
      }),
    );
    await waitFor(() =>
      expect(gateway.unsubscribes).toEqual([{ token: 'signed+key' }]),
    );
    expect(gateway.reads[0]).toEqual({ token: 'signed+key' });
  });
});
