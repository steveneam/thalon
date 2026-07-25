import {
  resolveDestination,
  type CredentialStoredState,
  type DESTINATIONS,
  type DestinationKey,
  type TenantCtx,
} from "@thalon/contracts";
import type { TenantCredential } from "@thalon/db";
import type { ThalonEnv } from "@thalon/platform";
import { z } from "zod";
import { decodeVaultMasterKey, openCredential, sealCredential } from "./crypto";
import { VaultNotConnectedError, VaultShapeError } from "./errors";

/**
 * B-int.1 (ADR 0011): the vault DOORS — the only code that composes the
 * contracts registry, the envelope crypto, and the B-int.0 storage repo.
 * The split, as frozen: the repo validates SHAPES and walls tenancy; this
 * layer validates the PASTE against the destination's connect schema
 * (before any crypto — a malformed paste stores nothing), seals/opens the
 * envelope, and hands callers either typed plaintext credentials (engine
 * seams only) or a REDACTED card projection (everything user-facing).
 * No door ever returns an envelope field — the API-response redaction
 * ratchet lives in `toCredentialCard`, and the boundary test pins that
 * this module never logs.
 */

/** The structural slice of Repos the doors need — callers hand the bundle, tests hand a stub. */
export interface VaultRepos {
  tenantCredentials: {
    connect(
      ctx: TenantCtx,
      input: {
        destination: DestinationKey;
        envelope: ReturnType<typeof sealCredential>;
        connectedAs?: string | null;
        expiresAt?: Date | null;
      },
    ): Promise<TenantCredential>;
    get(ctx: TenantCtx, destination: DestinationKey): Promise<TenantCredential | null>;
    list(ctx: TenantCtx): Promise<TenantCredential[]>;
    markStatus(
      ctx: TenantCtx,
      destination: DestinationKey,
      status: CredentialStoredState,
      opts?: { validatedAt?: Date; connectedAs?: string },
    ): Promise<TenantCredential>;
    remove(ctx: TenantCtx, destination: DestinationKey): Promise<void>;
  };
}

export interface VaultDeps {
  repos: VaultRepos;
  ctx: TenantCtx;
  env: ThalonEnv;
}

/**
 * The PUBLIC projection of a vault row — what B-int.2 cards and every API
 * response may carry. Explicit field picks; the four envelope columns can
 * never ride along.
 */
export interface CredentialCard {
  destination: string;
  status: string;
  connectedAs: string | null;
  validatedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toCredentialCard(row: TenantCredential): CredentialCard {
  return {
    destination: row.destination,
    status: row.status,
    connectedAs: row.connectedAs,
    validatedAt: row.validatedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The write door: validate the paste against the destination's connect
 * shape (issue PATHS only on failure — pasted values never ride an error),
 * seal, store. Reconnect/rotate is the same call (repo upsert semantics).
 */
export async function connectDestination(
  deps: VaultDeps,
  input: {
    destination: DestinationKey;
    credentials: unknown;
    connectedAs?: string | null;
    expiresAt?: Date | null;
  },
): Promise<CredentialCard> {
  const def = resolveDestination(input.destination);
  const parsed = def.credentials.safeParse(input.credentials);
  if (!parsed.success) {
    throw new VaultShapeError(
      input.destination,
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }
  const masterKey = decodeVaultMasterKey(deps.env.THALON_VAULT_MASTER_KEY);
  const envelope = sealCredential({
    masterKey,
    tenantId: deps.ctx.tenantId,
    destination: input.destination,
    plaintext: JSON.stringify(parsed.data),
  });
  const row = await deps.repos.tenantCredentials.connect(deps.ctx, {
    destination: input.destination,
    envelope,
    connectedAs: input.connectedAs,
    expiresAt: input.expiresAt,
  });
  return toCredentialCard(row);
}

/**
 * The read door — ENGINE SEAMS ONLY (drivers, probes, B-int.3 rewire).
 * Returns the typed plaintext credentials for one connected destination;
 * refuses loud when the tenant never connected it. Nothing user-facing
 * calls this: surfaces get cards.
 */
/** The typed plaintext a destination's connect schema admits. */
export type DestinationCredentials<K extends DestinationKey> = z.infer<
  (typeof DESTINATIONS)[K]["credentials"]
>;

export async function openDestinationCredentials<K extends DestinationKey>(
  deps: VaultDeps,
  destination: K,
): Promise<DestinationCredentials<K>> {
  const row = await deps.repos.tenantCredentials.get(deps.ctx, destination);
  if (!row) {
    throw new VaultNotConnectedError(destination);
  }
  return openCredentialRow(deps, row) as DestinationCredentials<K>;
}

/** Open one already-fetched row (the list-then-open paths avoid re-querying). */
export function openCredentialRow(deps: VaultDeps, row: TenantCredential): unknown {
  const destination = row.destination as DestinationKey;
  const def = resolveDestination(destination);
  const masterKey = decodeVaultMasterKey(deps.env.THALON_VAULT_MASTER_KEY);
  const plaintext = openCredential({
    masterKey,
    tenantId: deps.ctx.tenantId,
    destination,
    envelope: {
      ciphertext: row.ciphertext,
      dataKeyWrapped: row.dataKeyWrapped,
      iv: row.iv,
      authTag: row.authTag,
      keyVersion: row.keyVersion,
    },
  });
  return def.credentials.parse(JSON.parse(plaintext));
}

/** The cards read for B-int.2 — every row this tenant has, redacted. */
export async function listCredentialCards(deps: VaultDeps): Promise<CredentialCard[]> {
  const rows = await deps.repos.tenantCredentials.list(deps.ctx);
  return rows.map(toCredentialCard);
}

/** Disconnect — thin over the repo (row deletes, ledger remembers); here so no caller needs more than the doors. */
export async function disconnectDestination(
  deps: VaultDeps,
  destination: DestinationKey,
): Promise<void> {
  await deps.repos.tenantCredentials.remove(deps.ctx, destination);
}
