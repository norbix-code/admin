import { describe, it, expect } from 'vitest';
import { base64UrlToBytes, bytesToBase64Url } from './webauthn';

describe('webauthn base64url codec', () => {
  it('round-trips arbitrary bytes', () => {
    const original = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const encoded = bytesToBase64Url(original.buffer);
    const decoded = base64UrlToBytes(encoded);
    expect(Array.from(decoded)).to.deep.equal(Array.from(original));
  });

  it('produces URL-safe output with no padding', () => {
    // 0xfb,0xff,0xbf would be "+/+/" in standard base64 → must be "-" / "_".
    const encoded = bytesToBase64Url(new Uint8Array([0xfb, 0xff, 0xbf]).buffer);
    expect(encoded).to.not.match(/[+/=]/);
    expect(encoded).to.equal('-_-_');
  });

  it('decodes a known base64url value', () => {
    // "hi" → base64 "aGk=" → base64url "aGk"
    expect(Array.from(base64UrlToBytes('aGk'))).to.deep.equal([104, 105]);
  });

  it('decodes values that need re-padding', () => {
    // single byte 0xff → base64 "/w==" → base64url "_w"
    expect(Array.from(base64UrlToBytes('_w'))).to.deep.equal([255]);
  });
});
