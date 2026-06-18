// WebAuthn (passkey) browser helpers.
//
// The Norbix API speaks standard WebAuthn: the server returns `optionsJson`
// (a JSON string of PublicKeyCredentialCreationOptions / RequestOptions with
// base64url-encoded binary fields), the browser runs the ceremony with
// `navigator.credentials`, and we POST the credential back as a JSON string
// (`attestationResponse` for registration, `assertionResponse` for login).
//
// These helpers do only the encoding the browser API requires — no app logic.

/** True when the browser exposes the WebAuthn API. */
export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials
  );
}

// ---- base64url <-> ArrayBuffer ----

// Exported for unit testing the encoding round-trip. Not part of the public
// surface — UI code uses createPasskey / getPasskeyAssertion.
export function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// The base64url fields the server sends in the options JSON. We decode them
// into ArrayBuffers in place so `navigator.credentials.*` accepts them.
interface CredentialDescriptor {
  id: string;
  type: string;
  transports?: string[];
}

function decodeCreationOptions(
  json: Record<string, unknown>,
): PublicKeyCredentialCreationOptions {
  const pk = json as Record<string, unknown>;
  const user = pk.user as Record<string, unknown>;
  return {
    ...(pk as object),
    challenge: base64UrlToBytes(pk.challenge as string),
    user: { ...user, id: base64UrlToBytes(user.id as string) },
    excludeCredentials: ((pk.excludeCredentials as CredentialDescriptor[]) ?? []).map(
      (c) => ({ ...c, id: base64UrlToBytes(c.id), type: 'public-key' }),
    ),
  } as unknown as PublicKeyCredentialCreationOptions;
}

function decodeRequestOptions(
  json: Record<string, unknown>,
): PublicKeyCredentialRequestOptions {
  const pk = json as Record<string, unknown>;
  return {
    ...(pk as object),
    challenge: base64UrlToBytes(pk.challenge as string),
    allowCredentials: ((pk.allowCredentials as CredentialDescriptor[]) ?? []).map(
      (c) => ({ ...c, id: base64UrlToBytes(c.id), type: 'public-key' }),
    ),
  } as unknown as PublicKeyCredentialRequestOptions;
}

// Serialize a PublicKeyCredential back into the JSON shape the server expects
// (binary fields re-encoded as base64url).
function credentialToJson(cred: PublicKeyCredential): string {
  const response = cred.response as AuthenticatorAttestationResponse &
    AuthenticatorAssertionResponse;
  const out: Record<string, unknown> = {
    id: cred.id,
    rawId: bytesToBase64Url(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
    },
  };
  const r = out.response as Record<string, unknown>;
  if ('attestationObject' in response && response.attestationObject) {
    r.attestationObject = bytesToBase64Url(response.attestationObject);
  }
  if ('authenticatorData' in response && response.authenticatorData) {
    r.authenticatorData = bytesToBase64Url(response.authenticatorData);
    r.signature = bytesToBase64Url(response.signature);
    if (response.userHandle) r.userHandle = bytesToBase64Url(response.userHandle);
  }
  return JSON.stringify(out);
}

/**
 * Run a registration ceremony: parse the server's options JSON, prompt the
 * authenticator, and return the attestation as a JSON string.
 */
export async function createPasskey(optionsJson: string): Promise<string> {
  const options = decodeCreationOptions(JSON.parse(optionsJson));
  const cred = (await navigator.credentials.create({
    publicKey: options,
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Passkey creation was cancelled.');
  return credentialToJson(cred);
}

/**
 * Run an authentication ceremony: parse the server's options JSON, prompt the
 * authenticator, and return the assertion as a JSON string.
 */
export async function getPasskeyAssertion(optionsJson: string): Promise<string> {
  const options = decodeRequestOptions(JSON.parse(optionsJson));
  const cred = (await navigator.credentials.get({
    publicKey: options,
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Passkey sign-in was cancelled.');
  return credentialToJson(cred);
}
