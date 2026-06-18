// RTK Query error logger, mirroring the Cloud store's rtkQueryErrorLogger.
// Central place to observe rejected API calls (logging, toasts, 401 handling).
// Kept minimal: logs in dev only.

import {
  isRejectedWithValue,
  Middleware,
  MiddlewareAPI,
} from '@reduxjs/toolkit';

export const rtkQueryErrorLogger: Middleware =
  (_api: MiddlewareAPI) => (next) => (action) => {
    if (isRejectedWithValue(action)) {
      if (import.meta.env.DEV) {
        console.warn('[api] request rejected', action.payload);
      }
    }
    return next(action);
  };
