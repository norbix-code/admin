// Typed listener middleware, same role as the Cloud store's listener
// middleware: a place to register side effects that react to dispatched
// actions (e.g. clearing caches on sign-out). Empty by default — features add
// listeners via `startAppListening`.

import {
  createListenerMiddleware,
  addListener,
  TypedStartListening,
  TypedAddListener,
} from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from '@/app/store';

export const listenerMiddleware = createListenerMiddleware();

export type AppStartListening = TypedStartListening<RootState, AppDispatch>;

export const startAppListening =
  listenerMiddleware.startListening as AppStartListening;

export const addAppListener = addListener as TypedAddListener<
  RootState,
  AppDispatch
>;
