export interface LegalDocument {
  kind: 'terms' | 'privacy';
  title?: string;
  /** Markdown source of the published document. Empty when unavailable. */
  body: string;
  /** False when the project has not written this document. */
  available: boolean;
}
