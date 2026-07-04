import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tenantCtx } from "@thalon/contracts";
import { openDb } from "@thalon/db";
import { callTierJudge, gatewayJudgeDriver, type JudgeTier } from "@thalon/judge";
import { readEnv, withGatewayGuard, modelTiers } from "@thalon/platform";
import { parseJsonl } from "./dataset";
import { assertSoleDbWriter, loadEnvLocal, useWebAppDataDir } from "./env-local";

/**
 * LIVE golden-G3 runner (B1.5). Drives every `judge_g3_grounding` golden row
 * through BOTH real judge tiers via the gateway and compares each tier's
 * verdict to the row's expected verdict. This is the model-graded half of
 * the eval suite: it costs tokens and needs AI_GATEWAY_API_KEY, so it is
 * NEVER part of CI (the CI ship gate stays keyless by invariant) — run it
 * manually or on a schedule:  npm run -w @thalon/eval golden:g3
 * Spend is metered into tenant #0's usage ledger through the same
 * withGatewayGuard choke point as production calls. Exits 1 on any
 * tier/expected mismatch so a red run is loud.
 */
async function main(): Promise<void> {
  loadEnvLocal();
  useWebAppDataDir();
  await assertSoleDbWriter();

  const seedPath = fileURLToPath(new URL("../golden/seed.jsonl", import.meta.url));
  const rows = parseJsonl(readFileSync(seedPath, "utf8")).filter(
    (r) => r.kind === "judge_g3_grounding",
  );
  if (rows.length === 0) {
    console.log("no judge_g3_grounding rows in the golden seed — nothing to run");
    return;
  }

  const handle = await openDb();
  const driver = gatewayJudgeDriver();
  const tiers: JudgeTier[] = ["screen", "final"];
  const capTokens = readEnv().TENANT_DAILY_TOKEN_BUDGET;
  let mismatches = 0;

  try {
    const tenant = await handle.repos.tenants.getBySlug("self");
    if (!tenant) {
      throw new Error('tenant "self" not found — run the dogfood first: npm run -w @thalon/eval dogfood');
    }
    const ctx = tenantCtx(tenant.id);

    for (const row of rows) {
      const input = row.input as { claim: string; sources: string[] };
      const expected = (row.expected as { verdict: string }).verdict;
      const chunks = input.sources.map((text, i) => ({ ref: `golden-src-${i}`, text }));

      for (const tier of tiers) {
        const model = tier === "screen" ? modelTiers().judgeScreen : modelTiers().judgeFinal;
        const guarded: typeof driver = (req) =>
          withGatewayGuard({
            usage: {
              assertWithinBudget: (o) => handle.repos.usageLedger.assertWithinBudget(ctx, o),
              recordUsage: (o) => handle.repos.usageLedger.record(ctx, o),
            },
            capTokens,
            model,
            operation: `eval.golden_g3_${tier}`,
            call: async () => {
              const out = await driver(req);
              return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
            },
          });
        const result = await callTierJudge(guarded, { tier, body: input.claim, chunks });
        const ok = result.verdict === expected;
        if (!ok) mismatches++;
        console.log(
          `${ok ? "PASS" : "MISS"}  ${row.sourceRef}  tier=${tier}  expected=${expected}  got=${result.verdict}`,
        );
      }
    }
  } finally {
    await handle.close();
  }

  console.log(`golden g3: ${rows.length * tiers.length - mismatches}/${rows.length * tiers.length} tier-verdicts match`);
  if (mismatches > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
