import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { resolveSeams } from "@/lib/env";
import { InlineQueue } from "@/lib/queue";
import { LocalObjectStore } from "@/lib/storage";

describe("resolveSeams", () => {
  it("defaults to the zero-cloud dev seams", () => {
    const seams = resolveSeams({});
    expect(seams).toMatchObject({
      db: "sqlite",
      objectStore: "local",
      queue: "inline",
      auth: "dev",
      gateway: "unconfigured",
    });
  });

  it("flips each seam via env, never via code", () => {
    expect(resolveSeams({ DATABASE_URL: "postgres://x" }).db).toBe("postgres");
    expect(resolveSeams({ OBJECT_STORE: "s3" }).objectStore).toBe("s3");
    expect(resolveSeams({ QUEUE_DRIVER: "sqs" }).queue).toBe("sqs");
    expect(resolveSeams({ AI_GATEWAY_API_KEY: "k" }).gateway).toBe("configured");
    expect(
      resolveSeams({
        CLERK_SECRET_KEY: "sk",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk",
      }).auth,
    ).toBe("clerk");
  });

  it("requires BOTH Clerk keys before leaving the dev auth stub", () => {
    expect(resolveSeams({ CLERK_SECRET_KEY: "sk" }).auth).toBe("dev");
  });

  it("rejects unknown drivers loudly", () => {
    expect(() => resolveSeams({ OBJECT_STORE: "ftp" })).toThrow(/OBJECT_STORE/);
    expect(() => resolveSeams({ QUEUE_DRIVER: "kafka" })).toThrow(/QUEUE_DRIVER/);
  });
});

describe("LocalObjectStore", () => {
  const makeTmpStore = () => {
    const root = mkdtempSync(path.join(tmpdir(), "thalon-store-"));
    return { store: new LocalObjectStore(root), root };
  };

  it("round-trips put/get/list/delete", async () => {
    const { store, root } = makeTmpStore();
    try {
      await store.put("drafts/one.txt", "hello");
      expect((await store.get("drafts/one.txt"))?.toString()).toBe("hello");
      expect(await store.list("drafts/")).toEqual(["drafts/one.txt"]);
      await store.delete("drafts/one.txt");
      expect(await store.get("drafts/one.txt")).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects keys that escape the store root", async () => {
    const { store, root } = makeTmpStore();
    try {
      await expect(store.put("../escape.txt", "x")).rejects.toThrow(/invalid object key/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("InlineQueue", () => {
  it("executes a registered handler synchronously", async () => {
    const queue = new InlineQueue();
    const seen: string[] = [];
    queue.register("echo", (payload: string) => {
      seen.push(payload);
    });
    await queue.enqueue({ type: "echo", payload: "one" });
    expect(seen).toEqual(["one"]);
  });

  it("fails loud on unknown job types and duplicate registration", async () => {
    const queue = new InlineQueue();
    await expect(queue.enqueue({ type: "ghost", payload: null })).rejects.toThrow(
      /no handler/,
    );
    queue.register("dup", () => {});
    expect(() => queue.register("dup", () => {})).toThrow(/already registered/);
  });
});

describe("db seam", () => {
  afterEach(() => {
    resetDbForTests();
    vi.unstubAllEnvs();
  });

  it("opens a sqlite dev db under the configured data dir", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "thalon-db-"));
    try {
      vi.stubEnv("THALON_DATA_DIR", dir);
      const db = getDb();
      const row = db.get<{ one: number }>(sql`select 1 as one`);
      expect(row?.one).toBe(1);
    } finally {
      resetDbForTests();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails loud when DATABASE_URL is set before the postgres driver lands", () => {
    vi.stubEnv("DATABASE_URL", "postgres://not-yet");
    expect(() => getDb()).toThrow(/not wired yet/);
  });
});
