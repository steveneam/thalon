import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openDb, type Repos } from "@thalon/db";
import { toJsonl, type EvalRecord } from "./dataset";

/**
 * The read side of the "every override becomes an eval row" mechanism:
 * B0.3's approvals repo writes eval_cases in the same transaction as the
 * operator edit; this turns those rows into the JSONL dataset the suite
 * consumes. Deterministic, idempotent — regenerate any time, never commit
 * the output (datasets derive from the DB; the golden seed is the committed
 * part).
 */
export async function exportEvalCases(
  repos: Repos,
  ctx: TenantCtx,
  filter: { origin?: "edit_diff" | "golden" | "manual"; limit?: number } = {},
): Promise<EvalRecord[]> {
  const rows = await repos.evalCases.list(ctx, filter);
  return rows.map((row) => ({
    kind: row.kind,
    input: row.input as Record<string, unknown>,
    expected: row.expected as Record<string, unknown>,
    origin: row.origin as EvalRecord["origin"],
    sourceRef: row.sourceRef,
  }));
}

async function main(): Promise<void> {
  const slug = process.argv[2] ?? "self";
  const handle = await openDb();
  try {
    const tenant = await handle.repos.tenants.getBySlug(slug);
    if (!tenant) {
      throw new Error(
        `tenant "${slug}" not found in the dev database — pass a tenant slug: npm run -w @thalon/eval export -- <slug>`,
      );
    }
    const records = await exportEvalCases(handle.repos, tenantCtx(tenant.id));
    const outDir = fileURLToPath(new URL("../datasets", import.meta.url));
    mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `eval-cases.${slug}.jsonl`);
    writeFileSync(outFile, toJsonl(records));
    console.log(`wrote ${records.length} record(s) to ${outFile}`);
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
