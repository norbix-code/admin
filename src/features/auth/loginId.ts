// The signed-in user's LOGIN id — the `usr_…` Auth id the membership routes take
// (/membership/auth/{id}, /membership/auth/{id}/preferences).
//
// The /auth response's `userId` is ServiceStack's numeric UserAuthId (e.g. "2"),
// which those routes do not accept. The gateway writes the real id into the JWT
// as the `cm_auth_id` claim (GatewayAuth.cs CreatePayloadFilter), so we read it
// from the token. The token is only decoded, never trusted for anything else —
// the gateway still checks every call.

const LOGIN_ID_PREFIX = 'usr_';

export function isLoginId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.startsWith(LOGIN_ID_PREFIX);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
    );
    const payload: unknown = JSON.parse(json);
    return payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The `cm_auth_id` claim of a gateway JWT, when it is a `usr_` id. */
export function loginIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const claim = decodeJwtPayload(token)?.cm_auth_id;
  return typeof claim === 'string' && isLoginId(claim) ? claim : null;
}

/**
 * The login id for a session: the token claim first, then a `usr_` id the
 * sign-in flow passed along. A numeric id ("2") is never returned.
 */
export function resolveLoginId(
  token: string | null | undefined,
  fallback?: string | null,
): string | null {
  return loginIdFromToken(token) ?? (isLoginId(fallback) ? fallback : null);
}
