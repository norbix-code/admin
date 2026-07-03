// Runtime config slice: holds the resolved /echo response so the rest of the
// app (API base query, region selector, license-gated UI) reads endpoints
// discovered at runtime rather than hardcoded env values. Mirrors the Cloud
// store's `config` slice role.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type { EchoResponse } from '@/types/echo';
import { API_VERSION, API_PROXY_ROOT } from './env';

interface ConfigState {
  echo: EchoResponse | null;
}

const initialState: ConfigState = { echo: null };

const slice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    echoResolved(state, action: PayloadAction<EchoResponse>) {
      state.echo = action.payload;
    },
  },
});

export const { echoResolved } = slice.actions;

export const selectEcho = (state: RootState): EchoResponse | null =>
  state.config.echo;

/**
 * The API root to call — ALWAYS the same-origin BFF proxy (/api/proxy/api/v3).
 * The browser never targets the gateway host directly; the BFF re-targets to
 * the real API. So this is available immediately (no waiting on /echo for the
 * host) — echo still runs for regions/release, not for the base URL.
 */
export const selectApiRoot = (_state: RootState): string => API_PROXY_ROOT;

/** The proxy is same-origin and always available. */
export const selectApiReady = (_state: RootState): boolean => true;

export const selectRegions = (state: RootState) =>
  state.config.echo?.regions ?? [];

export const selectRelease = (state: RootState) => state.config.echo?.release;

export const selectApiVersion = (state: RootState): string =>
  state.config.echo?.apiVersion ?? API_VERSION;

export default slice.reducer;
