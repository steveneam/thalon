import { tenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { sha256Hex } from "../hash";
import { fixture, type Fixture } from "./helpers";

let fx: Fixture | undefined;
afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

describe("source_metrics repo (B2.2: generic metric_name/metric_value, append-only)", () => {
  it("appends and lists metrics per source in capture order", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const source = await repos.sources.create(fx.ctx, {
      kind: "exemplar",
      contentHash: sha256Hex("an exemplar post"),
    });
    await repos.sourceMetrics.add(fx.ctx, {
      sourceId: source.id,
      metricName: "view_count",
      metricValue: 120_000,
    });
    await repos.sourceMetrics.add(fx.ctx, {
      sourceId: source.id,
      metricName: "share_to_view_ratio",
      metricValue: 0.042,
    });
    const rows = await repos.sourceMetrics.listBySource(fx.ctx, source.id);
    expect(rows.map((r) => r.metricName)).toEqual(["view_count", "share_to_view_ratio"]);
    expect(rows[1].metricValue).toBeCloseTo(0.042);
  });

  it("scopes metrics to the tenant", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const source = await repos.sources.create(fx.ctx, {
      kind: "exemplar",
      contentHash: sha256Hex("scoped exemplar"),
    });
    await repos.sourceMetrics.add(fx.ctx, {
      sourceId: source.id,
      metricName: "view_count",
      metricValue: 7,
    });
    const other = await repos.tenants.create({ slug: "other", name: "Other" });
    const rows = await repos.sourceMetrics.listBySource(tenantCtx(other.id), source.id);
    expect(rows).toEqual([]);
  });
});

describe("sources (tenant_id, content_hash) unique index (B2.2: idempotency made structural)", () => {
  it("rejects a duplicate content hash within a tenant, allows it across tenants", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const contentHash = sha256Hex("the same payload");
    await repos.sources.create(fx.ctx, { kind: "prompt", contentHash });
    await expect(
      repos.sources.create(fx.ctx, { kind: "prompt", contentHash }),
    ).rejects.toThrow();
    const other = await repos.tenants.create({ slug: "other", name: "Other" });
    await expect(
      repos.sources.create(tenantCtx(other.id), { kind: "prompt", contentHash }),
    ).resolves.toMatchObject({ contentHash });
  });
});
