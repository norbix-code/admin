// `project` slice — holds the resolved public ProjectConfig (brand + auth)
// that drives the portal's look and login screen. Mirrors the Cloud store's
// per-project slice role. Persisted (and TTL-cached in localStorage by the
// loader) so repeat visits paint instantly.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type { ProjectConfig } from '@/types/projectConfig';

interface ProjectState {
  config: ProjectConfig | null;
}

const initialState: ProjectState = { config: null };

const slice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    projectConfigResolved(state, action: PayloadAction<ProjectConfig>) {
      state.config = action.payload;
    },
  },
});

export const { projectConfigResolved } = slice.actions;

export const selectProjectConfig = (state: RootState): ProjectConfig | null =>
  state.project.config;

export const selectProjectBranding = (state: RootState) =>
  state.project.config?.branding ?? null;

export const selectProjectAuth = (state: RootState) =>
  state.project.config?.auth ?? null;

export default slice.reducer;
