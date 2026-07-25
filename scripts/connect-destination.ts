/**
 * B-int.1 pre-surface connect CLI — the vault's guided-manual door until
 * B-int.2 ships the cards. Runs the EXACT flow a client will: validate the
 * paste against the DESTINATIONS shape → seal → store → read-only validate
 * ping (flips the card state honestly).
 *
 * Usage (secrets via env, never argv — argv leaks into `ps`):
 *   CONNECT_TENANT_ID=<uuid> \
 *   CONNECT_DESTINATION=<registry key> \
 *   CONNECT_CREDENTIALS_JSON='{"accessToken":"..."}' \
 *   [CONNECT_AS="public label"] \
 *   npx tsx scripts/connect-destination.ts
 *
 * Requires DATABASE_URL + THALON_VAULT_MASTER_KEY in the environment
 * (source apps/web/.env.local). Prints the redacted CARD only.
 */
import { destinationKeySchema, tenantCtx } from "@thalon/contracts";
import { openDb } from "@thalon/db";
import { connectDestination, validateDestination } from "@thalon/engine";
import { readEnv } from "@thalon/platform";

async function main(): Promise<void> {
  const env = readEnv();
  const tenantId = process.env.CONNECT_TENANT_ID;
  const destination = destinationKeySchema.parse(process.env.CONNECT_DESTINATION);
  const credentialsRaw = process.env.CONNECT_CREDENTIALS_JSON;
  if (!tenantId || !credentialsRaw) {
    throw new Error("CONNECT_TENANT_ID and CONNECT_CREDENTIALS_JSON are required");
  }
  const handle = await openDb();
  try {
    const deps = { repos: handle.repos, ctx: tenantCtx(tenantId), env };
    const card = await connectDestination(deps, {
      destination,
      credentials: JSON.parse(credentialsRaw) as unknown,
      connectedAs: process.env.CONNECT_AS ?? null,
    });
    console.log("connected:", JSON.stringify(card, null, 2));
    const validation = await validateDestination(deps, destination);
    console.log("validate ping:", JSON.stringify(validation.probe), "flipped:", validation.flipped);
  } finally {
    await handle.close();
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exitCode = 1;
});
