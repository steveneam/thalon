# KICKOFF — lane `s3-store` (S3 driver behind the object-store seam)

Read `CLAUDE.md` first. Branch `agent/s3-store`. `packages/contracts` + db
schema FROZEN — this lane touches neither. Founder-approved s71 close as part
of the s72 parallel wave.

## Mission

Complete the object store's second half: the S3 driver behind the EXISTING
seam in `packages/platform/src/object-store.ts` (the local filesystem driver
stays the default; `OBJECT_STORE=s3` currently throws "not wired yet — lands
Sprint 3+"). This is the flagged pre-launch gap: staging/production media
durability. Same interface, byte-identical semantics.

## Constraints (invariants)

- **Interface parity, exactly.** The engine's verified-read layer (B4.6:
  tampered bytes throw) sits ABOVE the store and must not change; the driver
  moves bytes, nothing else. Content-addressed keys, the object-keys registry,
  and sweep `PROTECTED_PREFIXES` behavior are untouched.
- **Deps:** `@aws-sdk/client-s3` only (Apache-2.0 — hygiene ✓). No wrappers.
- **Env (document in `.env.example`, never commit values):** `OBJECT_STORE=s3`
  selects it; `S3_BUCKET` + `S3_REGION` + optional `S3_PREFIX` +
  `S3_ENDPOINT` (MinIO/R2-compatible escape hatch); credentials via the
  STANDARD AWS chain only — never repo-committed, never logged. The Thalon
  AWS sub-account exists; its identifiers live in `.context/` ONLY — do not
  copy any account id/ARN into tracked files.
- **Honest failures:** missing bucket/creds fail LOUD at first use with an
  operator-readable message (the seam's existing error style), never a quiet
  fallback to local.
- **Tests: zero live network.** Fake the S3 client (command-level fake or
  aws-sdk client mock): round-trip bytes, prefix handling, not-found shape
  parity with the local driver (the engine's "missing" semantics depend on
  it), selection-by-env pin, loud-failure pin. Extend the existing
  object-store test file's pattern; local-driver tests stay green untouched.
- Small ops note in `docs/` (or extend the existing storage doc): bucket
  expectations (private, versioning recommendation, lifecycle none), how the
  verified-read layer means S3-side tampering surfaces as engine errors.

## Wrap

`agent_handoff/WRAP-s3-store.md`: interface diffs (should be ~none), env
table, test inventory, what the founder must provision (bucket + IAM policy
sketch, least-privilege: Get/Put/Head on the one prefix) — provisioning
itself is a founder/console step, NOT this lane. Full `npm run verify`
(unfiltered) green + grep guard before commit. The LEAD merges on green
post-merge verify.
