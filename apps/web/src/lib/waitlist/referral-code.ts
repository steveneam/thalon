/**
 * Opaque, URL-safe referral codes. The repo treats a collision as a raw
 * unique violation by design (packages/db repos/waitlist.ts) — the caller
 * regenerates and retries (join.ts) — so the only jobs here are entropy and
 * legibility: 10 chars over a 31-symbol alphabet (~49 bits) with the
 * ambiguous 0/1/i/l/o dropped, since these codes get read aloud and retyped.
 */

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const REFERRAL_CODE_LENGTH = 10;

export function generateReferralCode(): string {
  const bytes = new Uint8Array(REFERRAL_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return code;
}
