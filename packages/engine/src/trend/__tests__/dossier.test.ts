import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver } from "../../ingest/shell/embedder";
import { generateTrendDossiers } from "../dossier";
import { createFakeTrendSource } from "../fake-source";
import { createFakeDossierDriver, trendDossierPromptVersion, type DossierDriver } from "../shell/dossier";
import { readSweepBundle, runTrendSweep } from "../sweep";
import type { TrendItem } from "../trend-source";

let handle: DbHandle | undefined;
let storeRoot: string | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

const NOW = 1_750_000_000_000;
const DAY = 24 * 3_600_000;

const AREA = { name: "AI video tooling", description: "Deterministic render pipelines for faceless channels" };

const ITEMS: TrendItem[] = [
  {
    externalId: "hot",
    url: "https://platform.test/hot",
    text: AREA.description, // byte-identical to the area description → cosine 1 on the hash-embedding fake
    account: "alpha",
    publishedAt: NOW - DAY,
    metrics: { views: 120_000, shares: 3_000, bookmarks: 5_000 },
  },
  {
    externalId: "meh",
    text: "an unremarkable clip about cooking",
    account: "alpha",
    publishedAt: NOW - DAY,
    metrics: { views: 1_000, shares: 2, bookmarks: 1 },
  },
];

async function setup(denylist: string[] = []) {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist, platformProfiles: {} },
    activate: true,
  });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-dossier-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot), embedder: createFakeEmbeddingDriver(1536) };
}

const CARD = {
  cardId: "area-1:hot",
  itemText: "Deterministic render pipelines for faceless channels",
  source: "fake",
  account: "alpha",
  areaName: AREA.name,
  areaDescription: AREA.description,
};

describe("generateTrendDossiers", () => {
  it("returns a gated dossier per card, deterministic on the fake driver, with prompt-version provenance", async () => {
    const { ctx, repos } = await setup();
    const run = () =>
      generateTrendDossiers(ctx, repos, [CARD], { driver: createFakeDossierDriver(), capTokens: 1_000_000 });

    const first = await run();
    const second = await run();
    expect(first.failed).toEqual([]);
    const dossier = first.dossiers.get(CARD.cardId);
    expect(dossier).toBeDefined();
    expect(dossier!.titles.length).toBeGreaterThanOrEqual(3);
    expect(dossier!.angles.length).toBeGreaterThanOrEqual(2);
    expect(dossier!.hook.length).toBeGreaterThan(0);
    expect(dossier!.promptVersion).toBe(trendDossierPromptVersion());
    expect(second.dossiers.get(CARD.cardId)).toEqual(dossier); // identical request → identical dossier
  });

  it("drops the WHOLE dossier on a G1 denylist hit — reported with the matched term, never partial", async () => {
    // The fake driver derives titles verbatim from the item text, so denylisting
    // one of its words guarantees a hit.
    const { ctx, repos } = await setup(["faceless"]);
    const result = await generateTrendDossiers(ctx, repos, [CARD], {
      driver: createFakeDossierDriver(),
      capTokens: 1_000_000,
    });
    expect(result.dossiers.size).toBe(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].cardId).toBe(CARD.cardId);
    expect(result.failed[0].reason).toContain("denylist");
  });

  it("degrades per card on generation failure — the reason is reported verbatim, other cards still land", async () => {
    const { ctx, repos } = await setup();
    const fake = createFakeDossierDriver();
    const flaky: DossierDriver = async (req) => {
      if (req.itemText.includes("cooking")) throw new Error("driver exploded");
      return fake(req);
    };
    const other = { ...CARD, cardId: "area-1:meh", itemText: "an unremarkable clip about cooking" };
    const result = await generateTrendDossiers(ctx, repos, [CARD, other], {
      driver: flaky,
      capTokens: 1_000_000,
    });
    expect(result.dossiers.has(CARD.cardId)).toBe(true);
    expect(result.dossiers.has(other.cardId)).toBe(false);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({ cardId: other.cardId });
    expect(result.failed[0].reason).toContain("driver exploded");
  });
});

describe("runTrendSweep dossier ration", () => {
  it("arms via dossierCards: the TOP N cards carry dossiers, the rest honestly do not, and the bundle round-trips", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    await repos.monitoredAreas.create(ctx, AREA);

    const { bundle, dossiersFailed } = await runTrendSweep(
      ctx,
      repos,
      { nowMs: NOW, dossierCards: 1 },
      {
        source: createFakeTrendSource(ITEMS),
        embedder,
        objectStore,
        dossierDriver: createFakeDossierDriver(),
        capTokens: 1_000_000,
      },
    );

    expect(dossiersFailed).toEqual([]);
    expect(bundle.cards).toHaveLength(2);
    expect(bundle.cards[0].dossier).toBeDefined(); // the ration covers exactly the top card
    expect(bundle.cards[0].dossier!.titles.length).toBeGreaterThanOrEqual(3);
    expect(bundle.cards[1].dossier).toBeUndefined();

    const read = await readSweepBundle(ctx.tenantId, objectStore);
    expect(read).toEqual(bundle); // dossier survives the wire schema
  });

  it("stays disarmed by default (TREND_DOSSIER_CARDS=0): no dossier driver is ever invoked", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    await repos.monitoredAreas.create(ctx, AREA);
    let invoked = 0;
    const spyDriver: DossierDriver = async (req) => {
      invoked++;
      return createFakeDossierDriver()(req);
    };

    const { bundle } = await runTrendSweep(
      ctx,
      repos,
      { nowMs: NOW },
      { source: createFakeTrendSource(ITEMS), embedder, objectStore, dossierDriver: spyDriver, capTokens: 1_000_000 },
    );

    expect(invoked).toBe(0);
    expect(bundle.cards.every((card) => card.dossier === undefined)).toBe(true);
  });

  it("a failing dossier ration degrades the cards, not the sweep — failures reported, bundle persisted", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    await repos.monitoredAreas.create(ctx, AREA);
    const broken: DossierDriver = async () => {
      throw new Error("gateway unreachable");
    };

    const { bundle, dossiersFailed } = await runTrendSweep(
      ctx,
      repos,
      { nowMs: NOW, dossierCards: 2 },
      { source: createFakeTrendSource(ITEMS), embedder, objectStore, dossierDriver: broken, capTokens: 1_000_000 },
    );

    expect(bundle.cards).toHaveLength(2); // the sweep the operator asked for still landed
    expect(bundle.cards.every((card) => card.dossier === undefined)).toBe(true);
    expect(dossiersFailed).toHaveLength(2);
    expect(dossiersFailed[0].reason).toContain("gateway unreachable");
    expect(await readSweepBundle(ctx.tenantId, objectStore)).toEqual(bundle);
  });
});
