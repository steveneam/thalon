import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { createMemoryDbClient } from "../db-client";
import { readEnv, resolveSeams } from "../env";
import { modelTiers } from "../gateway";
import { InlineQueue } from "../queue";
import {
  getObjectStore,
  LocalObjectStore,
  S3ObjectStore,
  type S3ClientHandle,
} from "../object-store";

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

/**
 * Command-level S3 fake (zero network): an in-memory bucket that answers the
 * exact four commands the driver sends, including the SDK's real NoSuchKey
 * shape for missing reads and ListObjectsV2 continuation-token pagination.
 */
class FakeS3 {
  readonly objects = new Map<string, Buffer>();
  failWith: Error | undefined;

  constructor(private readonly pageSize = 1000) {}

  async send(command: unknown): Promise<unknown> {
    if (this.failWith) throw this.failWith;
    if (command instanceof PutObjectCommand) {
      const key = command.input.Key ?? "";
      this.objects.set(key, Buffer.from(command.input.Body as Uint8Array));
      return {};
    }
    if (command instanceof GetObjectCommand) {
      const bytes = this.objects.get(command.input.Key ?? "");
      if (!bytes) {
        throw new NoSuchKey({
          $metadata: { httpStatusCode: 404 },
          message: "The specified key does not exist.",
        });
      }
      return {
        Body: { transformToByteArray: async () => new Uint8Array(bytes) },
      };
    }
    if (command instanceof DeleteObjectCommand) {
      // Real S3 answers 204 whether or not the key existed.
      this.objects.delete(command.input.Key ?? "");
      return {};
    }
    if (command instanceof ListObjectsV2Command) {
      const prefix = command.input.Prefix ?? "";
      const all = [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = command.input.ContinuationToken
        ? Number(command.input.ContinuationToken)
        : 0;
      const page = all.slice(start, start + this.pageSize);
      const next = start + this.pageSize < all.length ? String(start + this.pageSize) : undefined;
      return {
        Contents: page.map((Key) => ({ Key })),
        IsTruncated: next !== undefined,
        NextContinuationToken: next,
      };
    }
    throw new Error("FakeS3: unhandled command");
  }
}

describe("S3ObjectStore", () => {
  const makeStore = (opts: { prefix?: string; pageSize?: number } = {}) => {
    const fake = new FakeS3(opts.pageSize);
    const store = new S3ObjectStore({
      bucket: "test-bucket",
      prefix: opts.prefix,
      client: fake as unknown as S3ClientHandle,
    });
    return { fake, store };
  };

  it("round-trips put/get/list/delete — local-driver parity", async () => {
    const { store } = makeStore();
    await store.put("drafts/one.txt", "hello");
    expect((await store.get("drafts/one.txt"))?.toString()).toBe("hello");
    expect(await store.list("drafts/")).toEqual(["drafts/one.txt"]);
    await store.delete("drafts/one.txt");
    expect(await store.get("drafts/one.txt")).toBeNull();
  });

  it("round-trips binary bytes unchanged", async () => {
    const { store } = makeStore();
    const bytes = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    await store.put("assets/blob.bin", bytes);
    expect((await store.get("assets/blob.bin"))?.equals(bytes)).toBe(true);
  });

  it("reads a missing key as null — the engine's absence semantics", async () => {
    const { store } = makeStore();
    expect(await store.get("web-pages/ghost.html")).toBeNull();
  });

  it("deletes idempotently (missing key is not an error)", async () => {
    const { store } = makeStore();
    await expect(store.delete("never/was.txt")).resolves.toBeUndefined();
  });

  it("applies S3_PREFIX on the wire and strips it from every answer", async () => {
    const { fake, store } = makeStore({ prefix: "env-a/" });
    await store.put("drafts/one.txt", "x");
    expect([...fake.objects.keys()]).toEqual(["env-a/drafts/one.txt"]);
    expect((await store.get("drafts/one.txt"))?.toString()).toBe("x");
    expect(await store.list()).toEqual(["drafts/one.txt"]);
    expect(await store.list("drafts/")).toEqual(["drafts/one.txt"]);
    await store.delete("drafts/one.txt");
    expect(fake.objects.size).toBe(0);
  });

  it("paginates list across continuation tokens", async () => {
    const { store } = makeStore({ pageSize: 2 });
    for (const n of ["a", "b", "c", "d", "e"]) await store.put(`p/${n}.txt`, n);
    expect(await store.list("p/")).toEqual([
      "p/a.txt",
      "p/b.txt",
      "p/c.txt",
      "p/d.txt",
      "p/e.txt",
    ]);
  });

  it("rejects keys that escape the store root", async () => {
    const { store } = makeStore();
    await expect(store.put("../escape.txt", "x")).rejects.toThrow(/invalid object key/);
    await expect(store.get("/absolute.txt")).rejects.toThrow(/invalid object key/);
    await expect(store.delete("a/../../b.txt")).rejects.toThrow(/invalid object key/);
  });

  it("fails loud and operator-readable on non-404 S3 errors — never null, never a local fallback", async () => {
    const { fake, store } = makeStore();
    fake.failWith = Object.assign(new Error("Access Denied"), {
      name: "AccessDenied",
    });
    await expect(store.get("drafts/one.txt")).rejects.toThrow(
      /S3 object store: get "drafts\/one\.txt" failed against bucket "test-bucket"/,
    );
    await expect(store.put("drafts/one.txt", "x")).rejects.toThrow(
      /never falls back to local/,
    );
  });
});

describe("getObjectStore seam selection", () => {
  it("defaults to the local driver under THALON_DATA_DIR", () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "thalon-seam-"));
    try {
      expect(getObjectStore({ THALON_DATA_DIR: dataDir })).toBeInstanceOf(
        LocalObjectStore,
      );
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("selects the S3 driver purely via env", () => {
    const store = getObjectStore({
      OBJECT_STORE: "s3",
      S3_BUCKET: "some-bucket",
      S3_REGION: "ap-test-1",
    });
    expect(store).toBeInstanceOf(S3ObjectStore);
  });

  it("fails LOUD when s3 is selected with incomplete config — never a quiet local fallback", () => {
    expect(() => getObjectStore({ OBJECT_STORE: "s3" })).toThrow(
      /S3_BUCKET and S3_REGION are not set/,
    );
    expect(() => getObjectStore({ OBJECT_STORE: "s3", S3_BUCKET: "b" })).toThrow(
      /S3_REGION/,
    );
    expect(() => getObjectStore({ OBJECT_STORE: "s3", S3_REGION: "r" })).toThrow(
      /S3_BUCKET/,
    );
    // Empty string = unset (the blank-.env-line rule) — still loud.
    expect(() =>
      getObjectStore({ OBJECT_STORE: "s3", S3_BUCKET: "", S3_REGION: "r" }),
    ).toThrow(/S3_BUCKET/);
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
