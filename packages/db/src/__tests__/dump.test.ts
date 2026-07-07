import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openTestDb } from "../client";

describe("DbHandle.dumpTo (B6.7 backup hook)", () => {
  it("writes a consistent gzip tarball of the live database and reports its size", async () => {
    const handle = await openTestDb();
    const dir = mkdtempSync(path.join(tmpdir(), "thalon-dump-"));
    const target = path.join(dir, "backups", "pglite-dump.tar.gz");
    try {
      await handle.repos.tenants.create({ slug: "dump-proof", name: "Dump proof" });

      const { bytes } = await handle.dumpTo(target);
      expect(bytes).toBeGreaterThan(0);
      const written = readFileSync(target);
      expect(written.byteLength).toBe(bytes);
      // gzip magic bytes — the export is the compressed tarball, not a partial write.
      expect(written[0]).toBe(0x1f);
      expect(written[1]).toBe(0x8b);
      // The temp file never survives a completed dump (temp+rename discipline).
      expect(existsSync(`${target}.tmp`)).toBe(false);

      // The database stays open and usable after an export.
      expect(await handle.repos.tenants.getBySlug("dump-proof")).not.toBeNull();

      // A second dump overwrites in place (history lives in the box's snapshots).
      const second = await handle.dumpTo(target);
      expect(second.bytes).toBeGreaterThan(0);
    } finally {
      await handle.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
