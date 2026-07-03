import type { FieldMetaState } from 'react-final-form';

/** Show an error only when the user has interacted or submit failed. */
export function shouldShowFieldError(
  meta?: Pick<FieldMetaState<unknown>, 'error' | 'touched' | 'submitFailed'>,
): boolean {
  return !!(meta?.error && (meta.touched || meta.submitFailed));
}
