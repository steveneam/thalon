import type { DestinationKey } from "@thalon/contracts";

/**
 * B-int.1 (ADR 0011): the vault's refusal taxonomy. Every class carries a
 * REDACTION obligation stronger than the social ladder's: a vault error
 * message may name a destination, a key VERSION, or a zod issue PATH —
 * never plaintext credential material, never key bytes, never envelope
 * contents. The redaction tests pin this by sealing a known secret and
 * asserting no error path echoes it.
 */
export abstract class VaultError extends Error {
  abstract readonly refusal: string;
}

/** The write/read doors refuse outright when the box has no master key — a credential can never store or open unencrypted. */
export class VaultKeyMissingError extends VaultError {
  readonly refusal = "vault_key_missing";
  constructor() {
    super(
      "THALON_VAULT_MASTER_KEY is not set — the vault refuses. Generate one with `openssl rand -base64 32` and set it in the environment (KMS is the recorded swap path).",
    );
    this.name = "VaultKeyMissingError";
  }
}

/** The master key is present but not 32 base64 bytes — refuse before any crypto touches it. The raw value is deliberately never echoed. */
export class VaultKeyInvalidError extends VaultError {
  readonly refusal = "vault_key_invalid";
  constructor() {
    super(
      "THALON_VAULT_MASTER_KEY must be exactly 32 bytes, base64-encoded (`openssl rand -base64 32`) — the configured value is not",
    );
    this.name = "VaultKeyInvalidError";
  }
}

/**
 * A sealed envelope would not open: wrong master key, tampered ciphertext,
 * or an envelope moved to a row it was not sealed for (the AAD binds tenant
 * + destination). The message carries WHICH credential and version — never
 * why-shaped detail that could echo material.
 */
export class VaultOpenError extends VaultError {
  readonly refusal = "vault_open_failed";
  constructor(
    public readonly destination: DestinationKey,
    detail: string,
  ) {
    super(`the sealed credential for "${destination}" would not open: ${detail}`);
    this.name = "VaultOpenError";
  }
}

/**
 * The write door's shape check said no BEFORE encryption (contracts
 * DESTINATIONS credential schema). Carries issue PATHS only — the pasted
 * values themselves must never ride an error into a log.
 */
export class VaultShapeError extends VaultError {
  readonly refusal = "vault_shape_invalid";
  constructor(
    public readonly destination: DestinationKey,
    public readonly issuePaths: string[],
  ) {
    super(
      `the pasted credentials for "${destination}" do not match its connect shape — problem field(s): ${issuePaths.join(", ") || "(root)"}. Nothing was stored.`,
    );
    this.name = "VaultShapeError";
  }
}

/** A read door was asked for a destination this tenant never connected. */
export class VaultNotConnectedError extends VaultError {
  readonly refusal = "vault_not_connected";
  constructor(public readonly destination: DestinationKey) {
    super(`no credential is connected for "${destination}" on this tenant`);
    this.name = "VaultNotConnectedError";
  }
}
