/**
 * B2.4 invariant (ADR 0002 decision 4): PII is stripped at ingest,
 * deterministically, BEFORE anything is stored or embedded. Pure function —
 * no I/O, no model call (SPINE §1 doctrine: "deterministic fallbacks... are
 * pure functions — never delegated to a model").
 *
 * Placeholder substitution (never simple deletion) so the surrounding text
 * stays grammatically coherent for chunking/embedding downstream.
 *
 * Scope and known limits (documented, not silently assumed):
 *  - Email: standard local@domain.tld shape.
 *  - Phone: a digit-led run of 7+ characters (digits, spaces, dots, hyphens,
 *    parens, optional leading "+") whose DIGIT COUNT is between 9 and 15
 *    inclusive. The digit-count floor of 9 is deliberate: it clears common
 *    non-phone numeric runs that would otherwise false-positive (an ISO
 *    date like "2026-07-04" carries only 8 digits; short numeric ranges in
 *    exemplar prose typically carry fewer than 9 digits too) while still
 *    catching national (10-digit) and international (+countrycode) phone
 *    formats.
 *  - Handle: "@" followed by 2-30 word characters, not preceded by a word
 *    character or ".", checked AFTER the email pass so "user@example.com"
 *    never also emits a spurious [HANDLE].
 */
export interface PiiStripStats {
  emails: number;
  phones: number;
  handles: number;
}

export interface PiiStripResult {
  text: string;
  stats: PiiStripStats;
}

const EMAIL_RE = /[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_CANDIDATE_RE = /\+?\d[\d\s().-]{6,}\d/g;
const PHONE_MIN_DIGITS = 9;
const PHONE_MAX_DIGITS = 15;
const HANDLE_RE = /(?<![\w.@])@[A-Za-z0-9_]{2,30}\b/g;

/** Deterministic: identical input always yields identical output (and stats). */
export function stripPii(text: string): PiiStripResult {
  let emails = 0;
  let phones = 0;
  let handles = 0;

  let out = text.replace(EMAIL_RE, () => {
    emails++;
    return "[EMAIL]";
  });

  out = out.replace(PHONE_CANDIDATE_RE, (match) => {
    const digitCount = (match.match(/\d/g) ?? []).length;
    if (digitCount < PHONE_MIN_DIGITS || digitCount > PHONE_MAX_DIGITS) return match;
    phones++;
    return "[PHONE]";
  });

  out = out.replace(HANDLE_RE, () => {
    handles++;
    return "[HANDLE]";
  });

  return { text: out, stats: { emails, phones, handles } };
}
