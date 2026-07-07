import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { runG1Denylist } from "@thalon/judge";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
import { generateValidatedCandidate } from "../pipeline/repair-loop";
import { trendDossierShellOutputSchema, type TrendDossierShellOutput } from "./dossier-schemas";
import {
  gatewayDossierDriver,
  trendDossierPromptVersion,
  type DossierDriver,
} from "./shell/dossier";

/**
 * B6.5 dossier half-step: live title/angle/hook generation for the top
 * ranked sweep cards (the wire's optional `dossier` field, honest arming
 * note until now). The shell proposes; core DISPOSES:
 *
 *  1. Zod boundary via the ONE bounded repair loop (schema-invalid or
 *     thrown attempts consume repairs; a blown tenant budget propagates —
 *     operational halt, amendment A2, never swallowed);
 *  2. G1 denylist (the same pure gate intake runs, same per-tenant data)
 *     over titles + angles + hook — a hit drops the WHOLE dossier with the
 *     reason reported; the card ships dossier-less, never censored-but-
 *     partial.
 *
 * A per-card generation failure degrades that card honestly (no dossier)
 * and is REPORTED, never silent — enrichment failure must not kill the
 * sweep the operator asked for. Every attempt meters through the one
 * gateway choke point as `intel.dossier` (pinned in the B5.3 shell
 * inventory; the sibling gateway-boundary allowlist carries the shell).
 */

export interface DossierCardInput {
  /** The sweep card id (`${areaId}:${externalId}`) the result keys back to. */
  cardId: string;
  itemText: string;
  source: string;
  account: string;
  areaName: string;
  areaDescription: string;
}

export interface TrendDossier extends TrendDossierShellOutput {
  promptVersion: string;
}

export interface GenerateDossiersResult {
  /** cardId → gated dossier, only for cards whose generation survived both gates. */
  dossiers: Map<string, TrendDossier>;
  /** Per-card failures, verbatim reasons (repair-loop lastError or the G1 term) — reported, never silent. */
  failed: Array<{ cardId: string; reason: string }>;
}

export interface GenerateDossiersDeps {
  driver?: DossierDriver;
  capTokens?: number;
}

export async function generateTrendDossiers(
  ctx: TenantCtx,
  repos: Repos,
  cards: DossierCardInput[],
  deps: GenerateDossiersDeps = {},
): Promise<GenerateDossiersResult> {
  const result: GenerateDossiersResult = { dossiers: new Map(), failed: [] };
  if (cards.length === 0) return result;

  // Same per-tenant gate data as intake's screen — by the time dossiers run
  // in a sweep, intake has already required an active profile; standalone
  // callers without one just get an empty denylist (G1 passes trivially).
  const profile = await repos.brandProfiles.getActive(ctx);
  const denylist = (profile?.denylist as string[] | null) ?? [];

  const model = modelTiers().draft;
  const promptVersion = trendDossierPromptVersion();
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const rawDriver = deps.driver ?? gatewayDossierDriver();

  // Core meters the shell: EVERY attempt (including repair retries) routes
  // through the one gateway choke point — budget asserted before, usage
  // recorded after, span traced (SPINE §1; amendment A2). The shell driver
  // itself stays read-only.
  const guardedDriver: DossierDriver = (req) =>
    withGatewayGuard({
      usage: {
        assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
        recordUsage: (o) => repos.usageLedger.record(ctx, o),
      },
      capTokens,
      model,
      operation: "intel.dossier",
      call: async () => {
        const out = await rawDriver(req);
        return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
      },
    });

  for (const card of cards) {
    const generated = await generateValidatedCandidate(
      guardedDriver,
      {
        itemText: card.itemText,
        source: card.source,
        account: card.account,
        areaName: card.areaName,
        areaDescription: card.areaDescription,
      },
      trendDossierShellOutputSchema,
    );
    if (generated.output === null) {
      result.failed.push({
        cardId: card.cardId,
        reason: generated.lastError ?? `no valid dossier after ${generated.attempts} attempt(s)`,
      });
      continue;
    }
    const dossier = generated.output;
    const g1 = runG1Denylist({
      body: [...dossier.titles, ...dossier.angles, dossier.hook].join("\n"),
      denylist,
    });
    if (g1.verdict === "fail") {
      const terms = [...new Set(g1.evidence.claims.map((claim) => claim.claim))];
      result.failed.push({ cardId: card.cardId, reason: `denylist: matched ${terms.join(", ")}` });
      continue;
    }
    result.dossiers.set(card.cardId, { ...dossier, promptVersion });
  }
  return result;
}
