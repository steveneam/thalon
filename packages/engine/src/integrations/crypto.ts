import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { CredentialEnvelope, DestinationKey } from "@thalon/contracts";
import { VaultKeyInvalidError, VaultKeyMissingError, VaultOpenError } from "./errors";

/**
 * B-int.1 (ADR 0011): the envelope crypto behind the frozen B-int.0 shape —
 * AES-256-GCM everywhere, Node built-in crypto, $0/self-hostable.
 *
 * Per row: a fresh 32-byte data key encrypts the credential JSON (GCM, its
 * own iv + auth tag = the envelope's `iv`/`authTag`); the box master key
 * then wraps that data key (GCM again, wrap iv + wrap tag carried INSIDE
 * `dataKeyWrapped` so the frozen envelope shape needs no extra fields).
 * The data encryption binds AAD = tenant + destination + key version, so a
 * sealed envelope copied onto another row — another tenant's, another
 * destination's — refuses to open. Cloud KMS is the recorded swap path:
 * replace `wrapDataKey`/`unwrapDataKey` behind the same envelope shape
 * (trigger mirrors the object-store durability call: real traffic).
 *
 * Redaction: nothing in this module logs, and no thrown error carries key
 * bytes, plaintext, or ciphertext — pinned by the redaction tests.
 */

/** Bumped only when the wrap changes shape; stored per row so old envelopes name the version that sealed them. */
export const VAULT_KEY_VERSION = 1;

const DATA_KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Decode + validate the master key from its env string (base64 of exactly
 * 32 bytes). Refuses loud on absence or malformation; never echoes the
 * configured value.
 */
export function decodeVaultMasterKey(raw: string | undefined): Buffer {
  if (raw === undefined || raw === "") {
    throw new VaultKeyMissingError();
  }
  const key = Buffer.from(raw, "base64");
  // Buffer.from(base64) silently tolerates junk — the length check plus a
  // round-trip catches both truncation and non-base64 input.
  if (key.length !== DATA_KEY_BYTES || key.toString("base64").replace(/=+$/, "") !== raw.replace(/=+$/, "").replace(/\s/g, "")) {
    throw new VaultKeyInvalidError();
  }
  return key;
}

/** The AAD that binds an envelope to its row — tenant, destination, version. */
function envelopeAad(tenantId: string, destination: DestinationKey, keyVersion: number): Buffer {
  return Buffer.from(`thalon:vault:${keyVersion}:${tenantId}:${destination}`, "utf8");
}

/** KMS swap seam (wrap side): master key + data key in, self-describing wrapped blob out (wrap iv ‖ wrap tag ‖ wrapped key). */
function wrapDataKey(masterKey: Buffer, dataKey: Buffer): string {
  const wrapIv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", masterKey, wrapIv);
  const wrapped = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  return Buffer.concat([wrapIv, cipher.getAuthTag(), wrapped]).toString("base64");
}

/** KMS swap seam (unwrap side). Throws plain Error — callers convert to VaultOpenError with the destination. */
function unwrapDataKey(masterKey: Buffer, dataKeyWrapped: string): Buffer {
  const blob = Buffer.from(dataKeyWrapped, "base64");
  if (blob.length !== IV_BYTES + TAG_BYTES + DATA_KEY_BYTES) {
    throw new Error("wrapped data key is malformed");
  }
  const wrapIv = blob.subarray(0, IV_BYTES);
  const wrapTag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const wrapped = blob.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", masterKey, wrapIv);
  decipher.setAuthTag(wrapTag);
  return Buffer.concat([decipher.update(wrapped), decipher.final()]);
}

/** Seal a credential's plaintext JSON into the frozen envelope shape for one row. */
export function sealCredential(input: {
  masterKey: Buffer;
  tenantId: string;
  destination: DestinationKey;
  plaintext: string;
}): CredentialEnvelope {
  const dataKey = randomBytes(DATA_KEY_BYTES);
  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
    cipher.setAAD(envelopeAad(input.tenantId, input.destination, VAULT_KEY_VERSION));
    const ciphertext = Buffer.concat([cipher.update(input.plaintext, "utf8"), cipher.final()]);
    return {
      ciphertext: ciphertext.toString("base64"),
      dataKeyWrapped: wrapDataKey(input.masterKey, dataKey),
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      keyVersion: VAULT_KEY_VERSION,
    };
  } finally {
    dataKey.fill(0);
  }
}

/** Open a sealed envelope back to its plaintext JSON. Every failure is a VaultOpenError naming the credential, never the material. */
export function openCredential(input: {
  masterKey: Buffer;
  tenantId: string;
  destination: DestinationKey;
  envelope: CredentialEnvelope;
}): string {
  const { envelope, destination } = input;
  if (envelope.keyVersion !== VAULT_KEY_VERSION) {
    throw new VaultOpenError(
      destination,
      `sealed under key version ${envelope.keyVersion}; this box opens version ${VAULT_KEY_VERSION}`,
    );
  }
  let dataKey: Buffer | undefined;
  try {
    try {
      dataKey = unwrapDataKey(input.masterKey, envelope.dataKeyWrapped);
    } catch {
      throw new VaultOpenError(
        destination,
        "the master key cannot unwrap it — the key changed, or the envelope is corrupt",
      );
    }
    try {
      const decipher = createDecipheriv("aes-256-gcm", dataKey, Buffer.from(envelope.iv, "base64"));
      decipher.setAAD(envelopeAad(input.tenantId, destination, envelope.keyVersion));
      decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new VaultOpenError(
        destination,
        "tampered, or sealed for a different tenant/destination (the AAD binding refused)",
      );
    }
  } finally {
    dataKey?.fill(0);
  }
}
