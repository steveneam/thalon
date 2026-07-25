# S3 object store — ops note

The object-store seam (`packages/platform/src/object-store.ts`) ships two
drivers behind one interface: `local` (dev default, `<THALON_DATA_DIR>/objects`)
and `s3` (staging/production durability). Selection is env-only; the drivers
are byte-identical in semantics — put/get round-trip raw bytes, a missing key
reads as `null`, delete is idempotent, list returns sorted engine-relative
keys.

## Env

| var | required | meaning |
|---|---|---|
| `OBJECT_STORE=s3` | — | selects the driver (default `local`) |
| `S3_BUCKET` | yes | bucket name |
| `S3_REGION` | yes | bucket region |
| `S3_PREFIX` | no | key prefix inside the bucket (lets one bucket host several environments; never visible to callers) |
| `S3_ENDPOINT` | no | S3-compatible endpoint (MinIO / R2 escape hatch); set, the client switches to path-style addressing |

Credentials ride the **standard AWS chain** (env vars / shared profile /
instance role) — the engine never reads, stores, or logs them. `OBJECT_STORE=s3`
with `S3_BUCKET` or `S3_REGION` missing fails **loud at first use** with an
operator-readable error; there is deliberately no quiet fallback to local.

## Bucket expectations

- **Private.** Block all public access; the workspace serves public bytes
  through its own doors (e.g. the `/assets/<sha256>` allowlist route), never
  from the bucket directly.
- **Versioning: recommended.** Content-addressed families are immutable, but
  the mutable-pointer families (`sweeps/`, `posts/`, `public-assets/`) are
  overwritten in place — versioning is the cheap undo.
- **Lifecycle rules: none.** Deletion is the orphan sweep's job
  (`npm run -w @thalon/eval sweep`, dry-run by default) — a lifecycle rule
  would delete behind the registry's back.

## IAM sketch (least-privilege)

Engine runtime, scoped to the one prefix:

- `s3:GetObject`, `s3:PutObject` on `arn:aws:s3:::<bucket>/<prefix>/*`
- `s3:ListBucket` on `arn:aws:s3:::<bucket>` (condition: `s3:prefix`
  starts-with `<prefix>/`) — required for `list()` **and** for honest
  missing-key semantics: without it S3 answers 403 for absent keys instead of
  404, which the engine would surface as an error rather than "missing".

`s3:DeleteObject` on the same object ARN is needed only by the orphan-sweep
operator role, not the serving runtime — grant it separately if sweeps run
against S3.

## Verified reads & tampering

The B4.6 verified-read layer (`getContentAddressed` in
`packages/platform/src/object-keys.ts`) sits **above** the store and is
driver-agnostic: bytes are re-hashed on read and must match the sha256 the key
embeds. S3-side tampering or corruption of a content-addressed object
therefore surfaces as `ContentAddressMismatchError` in the engine — it is
never silently served. Mutable-pointer and cache families are not
content-verifiable by design (see the family registry in `object-keys.ts`);
bucket privacy + IAM are their protection.
