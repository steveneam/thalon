import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryDbClient } from "../db-client";
import { readEnv, resolveSeams } from "../env";
import { modelTiers } from "../gateway";
import { InlineQueue } from "../queue";
import { LocalObjectStore } from "../object-store";

describe("resolveSeams", () => {
  it("defaults to the zero-cloud dev seams", () => {
    const seams = resolveSeams({});
    expect(seams).toMatchObject({
      db: "pglite",
      objectStore: "local",
      queue: "inline",
      auth: "dev",
      gateway: "unconfigured",
      tracing: "unconfigured",
    });
  });

  it("flips each seam via env, never via code", () => {
    expect(resolveSeams({ DATABASE_URL: "postgres://x" }).db).toBe("postgres");
    expect(resolveSeams({ OBJECT_STORE: "s3" }).objectStore).toBe("s3");
    expect(resolveSeams({ QUEUE_DRIVER: "sqs" }).queue).toBe("sqs");
    expect(resolveSeams({ AI_GATEWAY_API_KEY: "k" }).gateway).toBe("configured");
    expect(
      resolveSeams({ LANGFUSE_PUBLIC_KEY: "pk", LANGFUSE_SECRET_KEY: "sk" }).tracing,
    ).toBe("configured");
    expect(resolveSeams({ LANGFUSE_PUBLIC_KEY: "pk" }).tracing).toBe("unconfigured");
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

  it("treats empty strings as unset — a blank .env line never flips a seam", () => {
    expect(resolveSeams({ DATABASE_URL: "" }).db).toBe("pglite");
    expect(resolveSeams({ AI_GATEWAY_API_KEY: "" }).gateway).toBe("unconfigured");
  });
});

describe("readEnv / modelTiers", () => {
  it("applies defaults and env overrides", () => {
    expect(modelTiers({})).toEqual({
      draft: "meta/llama-3.3-70b",
      judgeScreen: "meta/llama-3.3-70b",
      judgeFinal: "anthropic/claude-sonnet-4.5",
      embedding: "openai/text-embedding-3-small",
    });
    expect(modelTiers({ MODEL_JUDGE_FINAL: "acme/strong-1" }).judgeFinal).toBe(
      "acme/strong-1",
    );
  });

  it("validates the per-tenant daily budget", () => {
    expect(readEnv({}).TENANT_DAILY_TOKEN_BUDGET).toBe(2_000_000);
    expect(readEnv({ TENANT_DAILY_TOKEN_BUDGET: "5000" }).TENANT_DAILY_TOKEN_BUDGET).toBe(5000);
    expect(() => readEnv({ TENANT_DAILY_TOKEN_BUDGET: "-1" })).toThrow(
      /TENANT_DAILY_TOKEN_BUDGET/,
    );
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

describe("embedded-Postgres db client (amendment A1)", () => {
  // PGlite cold boot (WASM load + init) exceeds the 5s default under disk
  // contention, e.g. parallel worktree lanes; 30s still catches real hangs.
  it("answers SQL and has pgvector available", { timeout: 30_000 }, async () => {
    const client = createMemoryDbClient();
    try {
      const one = await client.query<{ one: number }>("select 1 as one");
      expect(one.rows[0]?.one).toBe(1);
      await client.exec("create extension if not exists vector");
      const dot = await client.query<{ d: number }>(
        "select '[1,2,3]'::vector <#> '[1,2,3]'::vector as d",
      );
      expect(dot.rows[0]?.d).toBeCloseTo(-14);
    } finally {
      await client.close();
    }
  });
});
