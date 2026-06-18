// Runtime config slice: holds the resolved /echo response so the rest of the
// app (API base query, region selector, license-gated UI) reads endpoints
// discovered at runtime rather than hardcoded env values. Mirrors the Cloud
// store's `config` slice role.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type { EchoResponse } from '@/types/echo';
import { API_VERSION } from './env';

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
 * The API root to call — ALWAYS the apiUrl discovered from /echo (already
 * versioned, e.g. https://api.norbix.ai/v3). Empty until echo resolves; the
 * portal blocks the UI until then, so no API call is made with an empty root.
 */
export const selectApiRoot = (state: RootState): string => {
  const fromEcho = state.config.echo?.apiUrl;
  return fromEcho ? fromEcho.replace(/\/$/, '') : '';
};

/** True once /echo has resolved and an API root is available. */
export const selectApiReady = (state: RootState): boolean =>
  Boolean(state.config.echo?.apiUrl);

export const selectRegions = (state: RootState) =>
  state.config.echo?.regions ?? [];

export const selectRelease = (state: RootState) => state.config.echo?.release;

export const selectApiVersion = (state: RootState): string =>
  state.config.echo?.apiVersion ?? API_VERSION;

export default slice.reducer;
