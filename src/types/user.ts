// End-user profile / contact info. Placeholder shape for the scaffold;
// Phase 1 replaces this with the generated Norbix API UserDto.
export interface UserProfile {
  userId: string;
  email: string;
  givenName?: string;
  familyName?: string;
  displayName?: string;
  phone?: string;
  locale?: string;
}

export interface MarketingSubscription {
  /** topic / list id */
  id: string;
  label: string;
  /** transactional messages cannot be fully disabled */
  kind: 'marketing' | 'transactional';
  subscribed: boolean;
}

export interface ComplianceInfo {
  dataCategories: string[];
  consents: { name: string; grantedAt: string }[];
  exportStatus?: 'none' | 'requested' | 'ready';
  exportUrl?: string;
}

export interface LegalDocument {
  kind: 'terms' | 'privacy';
  title?: string;
  /** Markdown source of the published document. Empty when unavailable. */
  body: string;
  /** False when the project hasn't published / exposed this document. */
  available: boolean;
}
