import { tenantCtx } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import { InvalidStateError, NotFoundError } from "../errors";
import { sha256Hex } from "../hash";
import { fixture } from "./helpers";

describe("sources.remove (library delete, s39)", () => {
  it("deletes an unreferenced source with its chunks in one transaction and audits it (I4)", async () => {
    const { handle, ctx, close } = await fixture();
    const { repos } = handle;
    try {
      const { source } = await repos.sourceChunks.ingest(ctx, {
        kind: "video_transcript",
        uri: "https://example.com/watch?v=abc",
        contentHash: sha256Hex("transcript-body"),
        chunks: [
          { seq: 0, text: "first segment", tokenCount: 2, contentHash: sha256Hex("first segment") },
        ],
      });

      await repos.sources.remove(ctx, source.id);

      expect(await repos.sources.get(ctx, source.id)).toBeNull();
      expect(await repos.sourceChunks.listBySource(ctx, source.id)).toEqual([]);
      const events = await repos.events.list(ctx, { entityType: "source", entityId: source.id });
      expect(events.map((e) => e.event)).toContain("source.deleted");
    } finally {
      await close();
    }
  });

  it("REFUSES to delete a source that grounds runs/drafts — provenance is never orphaned", async () => {
    const { handle, ctx, draft, close } = await fixture();
    const { repos } = handle;
    try {
      await expect(repos.sources.remove(ctx, draft.sourceId)).rejects.toThrow(InvalidStateError);
      expect(await repos.sources.get(ctx, draft.sourceId)).not.toBeNull();
    } finally {
      await close();
    }
  });

  it("holds the tenancy wall: a foreign tenant's remove is a NotFound, not a delete", async () => {
    const { handle, ctx, close } = await fixture();
    const { repos } = handle;
    try {
      const source = await repos.sources.create(ctx, {
        kind: "video_transcript",
        contentHash: sha256Hex("mine"),
      });
      const other = await repos.tenants.create({ slug: "other", name: "Other" });
      await expect(repos.sources.remove(tenantCtx(other.id), source.id)).rejects.toThrow(
        NotFoundError,
      );
      expect(await repos.sources.get(ctx, source.id)).not.toBeNull();
    } finally {
      await close();
    }
  });
});
