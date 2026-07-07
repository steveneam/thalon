import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openTestDb, type DbHandle } from "@thalon/db";
import { afterEach, describe, expect, it, vi } from "vitest";

// Route tests run against a fresh in-memory db per test (the B0.4 pattern);
// only the process-cached accessor is swapped.
let handle: DbHandle | undefined;
vi.mock("@/lib/repos", () => ({
  getDbHandle: () => {
    if (!handle) throw new Error("test db not opened");
    return Promise.resolve(handle);
  },
  getRepos: () => {
    if (!handle) throw new Error("test db not opened");
    return Promise.resolve(handle.repos);
  },
}));

const { POST } = await import("./route");

let dataDir: string | undefined;

afterEach(async () => {
  vi.unstubAllEnvs();
  await handle?.close();
  handle = undefined;
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
    dataDir = undefined;
  }
});

function dumpRequest(authorization?: string): Request {
  return new Request("http://localhost/api/admin/db-dump", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe("POST /api/admin/db-dump", () => {
  it("FAILS CLOSED (503) when DB_DUMP_TOKEN is not configured — never an open hook", async () => {
    const res = await POST(dumpRequest("Bearer anything"));
    expect(res.status).toBe(503);
  });

  it("rejects a missing or wrong bearer token with 401", async () => {
    vi.stubEnv("DB_DUMP_TOKEN", "correct-token");
    expect((await POST(dumpRequest())).status).toBe(401);
    expect((await POST(dumpRequest("Bearer wrong-token"))).status).toBe(401);
    expect((await POST(dumpRequest("Basic correct-token"))).status).toBe(401);
  });

  it("dumps the live database into <THALON_DATA_DIR>/backups and reports path/bytes", async () => {
    handle = await openTestDb();
    dataDir = mkdtempSync(path.join(tmpdir(), "thalon-dump-route-"));
    vi.stubEnv("DB_DUMP_TOKEN", "correct-token");
    vi.stubEnv("THALON_DATA_DIR", dataDir);

    const res = await POST(dumpRequest("Bearer correct-token"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { path: string; bytes: number; ms: number };
    expect(body.path).toBe(path.resolve(dataDir, "backups", "pglite-dump.tar.gz"));
    expect(body.bytes).toBeGreaterThan(0);
    const written = readFileSync(body.path);
    expect(written.byteLength).toBe(body.bytes);
    // gzip magic — a real compressed export, not a partial write.
    expect(written[0]).toBe(0x1f);
    expect(written[1]).toBe(0x8b);
  });
});
