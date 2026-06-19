// Shape of the gateway's GET /{version}/echo response.
// Mirrors EchoResponse in the gateway
// (Isidos.CodeMash.Services.Api/Heartbeat/Echo.cs). The portal calls this on
// the Hub to discover the API URL, regions, release, and license — so only the
// Hub URL needs to be configured via env.

export type CodeMashRelease =
  | 'NotSet'
  | 'Community'
  | 'ManagedService'
  | 'Enterprise';

export type CodeMashRuntime = 'Development' | 'Staging' | 'Production' | string;

export interface EchoRegion {
  code: string;
  displayName: string;
  apiUrl: string;
  hubUrl: string;
}

export interface EchoLicense {
  domain: string;
  accountId: string;
  refCustomerId?: string;
  refSubscriptionId?: string;
  issued: number;
  expire: number;
  cap: number;
  isTrial: boolean;
  release: string;
  // Convenience fields the gateway also serializes.
  projectsCap?: number;
  issuedOn?: number;
  expireOn?: number;
}

export interface EchoResponse {
  containerName?: string;
  ip: string;
  release: CodeMashRelease;
  runtime: CodeMashRuntime;
  managedServiceHubUrl: string;
  managedServiceApiUrl: string;
  hubUrl: string;
  apiUrl: string;
  apiVersion: string;
  hubVersion: string;
  mjmlUrl: string;
  /**
   * Canonical Admin-Portal URL template for this deployment, with a literal
   * `{projectId}` placeholder, e.g. `https://{projectId}.admin.norbix.ai`.
   * Substitute the project id to get a concrete URL. Null when no admin host is
   * configured. (Per-project custom overrides live on the project read model.)
   */
  adminUrlTemplate?: string | null;
  license?: EchoLicense | null;
  askForEnterpriseLicenseEmail?: string | null;
  regions?: EchoRegion[] | null;
}
