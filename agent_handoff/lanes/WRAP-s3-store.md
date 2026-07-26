# WRAP — lane `s3-store` (S3 driver behind the object-store seam, s72)

Branch `agent/s3-store`, one commit, full `npm run verify` green (unfiltered),
grep guard clean. Contracts + db schema UNTOUCHED. The engine's verified-read
layer (B4.6), the object-keys registry, and sweep `PROTECTED_PREFIXES` are all
untouched — the driver moves bytes, nothing else.

## What shipped

**`OBJECT_STORE=s3` now selects a real driver instead of throwing "lands
Sprint 3+".** `packages/platform/src/object-store.ts` gains `S3ObjectStore`
behind the existing `ObjectStore` interface, byte-identical semantics to the
local driver:

- put/get round-trip raw bytes (strings become utf8 exactly like
  `writeFileSync`); a missing key reads as `null` (the SDK's
  NoSuchKey/NotFound/404 shapes all map to the engine's absence semantics);
  delete is idempotent (S3 parity with `rmSync force:true`); list paginates
  ListObjectsV2 and returns sorted engine-relative keys.
- **Key guard parity:** the same `invalid object key (escapes store root)`
  refusal as the local driver (empty/dot/dotdot segments, absolute keys).
- **`S3_PREFIX` never leaks:** applied on the wire, stripped from every
  answer — callers see engine-relative keys on both drivers.
- **Honest failures (the seam's style):** `OBJECT_STORE=s3` with
  `S3_BUCKET`/`S3_REGION` missing fails LOUD at `getObjectStore()` naming
  exactly what's missing; non-404 S3 errors rethrow operator-readable
  (operation + key + bucket + the standard-chain hint, SDK error as
  `cause`) — never `null`, never a quiet local fallback, never credential
  material in messages.
- One `S3Client` memoized per (region, endpoint) — `getObjectStore()` is
  called per operation across the engine; sockets shouldn't reconnect each
  call. `S3_ENDPOINT` set implies path-style addressing (MinIO/R2).

## Interface diffs (~none, as specced)

- `ObjectStore` interface: **unchanged.**
- `LocalObjectStore`: **unchanged** (its tests untouched, green).
- `getObjectStore()`: gained one OPTIONAL `env?: EnvSource` parameter
  (test seam; every existing caller passes nothing and behaves exactly as
  before). The boundary ratchet still holds — the process environment is
  read only inside `env.ts` via `readEnv`'s default.
- New exports: `S3ObjectStore`, `S3ObjectStoreOptions`, `S3ClientHandle`
  (`Pick<S3Client, "send">` — the one SDK surface the driver touches).

## Env (documented in `apps/web/.env.example`; values never committed)

| var | required | meaning |
|---|---|---|
| `OBJECT_STORE=s3` | — | selects the driver (default `local`) |
| `S3_BUCKET` | yes (under s3) | bucket name |
| `S3_REGION` | yes (under s3) | bucket region |
| `S3_PREFIX` | no | key prefix inside the bucket (multi-env bucket sharing) |
| `S3_ENDPOINT` | no | MinIO/R2-compatible endpoint; implies path-style |

Credentials: STANDARD AWS chain only (env / profile / role) — never read by
the engine, never logged. Zod schema additions live in
`packages/platform/src/env.ts` (empty string = unset, per the blank-.env-line
rule, tested).

## Dependency

`@aws-sdk/client-s3` ^3.1095.0 (Apache-2.0 — hygiene ✓), no wrappers.
Installed from the MAIN checkout per the worktree-install ratchet; this branch
carries the `package.json` + `package-lock.json` delta, the shared
`node_modules` already has the tree, main's manifests were restored clean.

## Tests (13 new, zero live network; in `seams.test.ts`, the existing file's pattern)

Command-level `FakeS3` (answers the exact four commands the driver sends,
throws the SDK's real `NoSuchKey` for missing reads, paginates with real
continuation tokens):

1. put/get/list/delete round-trip — local-driver parity
2. binary bytes round-trip unchanged (0..255)
3. missing key → `null` (not-found shape parity)
4. delete idempotent on missing key
5. `S3_PREFIX` applied on the wire, stripped from every answer
6. list paginates across continuation tokens
7. escaping keys refused (`../`, absolute, embedded `..`) — same error text as local
8. non-404 errors rethrow loud + operator-readable (never null/fallback)
9. seam selection: default env → `LocalObjectStore`
10. seam selection: `OBJECT_STORE=s3` + bucket + region → `S3ObjectStore`
11. loud failure naming `S3_BUCKET and S3_REGION` when both missing
12. loud failure naming the single missing one (each direction)
13. empty-string env = unset → still loud

Local-driver tests untouched and green; full unfiltered `npm run verify`
green (guard + 1889-test suite + typecheck + lint). One pre-existing ratchet
did its job mid-lane: `tests/boundary.test.ts` refused a reference to the
process environment outside `env.ts` (even in a comment) — reworded, ratchet
green.

## What the founder must provision (console step, NOT this lane)

Ops notes shipped in `docs/OBJECT-STORE-S3.md`. Summary:

1. **Bucket** in the sub-account (identifiers stay in `.context/` only):
   private / block all public access, **versioning on** (the mutable-pointer
   families are overwritten in place — versioning is the cheap undo),
   **no lifecycle rules** (deletion belongs to the orphan sweep only).
2. **IAM, least-privilege, one prefix:**
   - `s3:GetObject` + `s3:PutObject` on `arn:aws:s3:::<bucket>/<prefix>/*`
   - `s3:ListBucket` on the bucket, condition `s3:prefix` starts-with
     `<prefix>/` — one honest delta from the kickoff's Get/Put/Head sketch:
     `list()` is part of the store interface, and without ListBucket S3
     answers 403 (not 404) for missing keys, which would break the engine's
     "missing = null" semantics. Head alone isn't used by the driver.
   - `s3:DeleteObject` only on the sweep-operator role, not the serving
     runtime.
3. **Runtime env on the box:** `OBJECT_STORE=s3` + `S3_BUCKET` + `S3_REGION`
   (+ optional `S3_PREFIX`), credentials via the standard chain.
4. Note: switching a live box local→s3 does not migrate existing objects;
   the local `<THALON_DATA_DIR>/objects` tree would need a one-time copy
   (`aws s3 sync`) — flagging so it's a decision, not a surprise.

S3-side tampering surfaces as `ContentAddressMismatchError` at the B4.6
verified-read layer — corrupted content is never silently served.
