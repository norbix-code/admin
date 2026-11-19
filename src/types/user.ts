export interface LegalDocument {
  kind: 'terms' | 'privacy';
  title?: string;
  /** Markdown source of the published document. Empty when unavailable. */
  body: string;
  /** False when the project hasn't published / exposed this document. */
  available: boolean;
}
