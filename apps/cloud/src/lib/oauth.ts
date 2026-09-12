/** PKCE + state para OAuth (server-only) — §16.1. */
import { randomBytes, createHash } from 'node:crypto';

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

export function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface PkcePair {
  verifier: string;
  challenge: string; // S256
}

export function generatePkce(): PkcePair {
  const verifier = b64url(randomBytes(48)); // 64 chars base64url
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return b64url(randomBytes(24));
}
