import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { resolveSeams } from "@/lib/env";

export interface ObjectStore {
  put(key: string, data: Buffer | string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

/** Filesystem-backed store for dev; the S3 driver replaces it behind the same interface. */
export class LocalObjectStore implements ObjectStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    mkdirSync(this.root, { recursive: true });
  }

  private resolveKey(key: string): string {
    const abs = path.resolve(this.root, key);
    if (!abs.startsWith(this.root + path.sep)) {
      throw new Error(`invalid object key (escapes store root): "${key}"`);
    }
    return abs;
  }

  async put(key: string, data: Buffer | string): Promise<void> {
    const abs = this.resolveKey(key);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, data);
  }

  async get(key: string): Promise<Buffer | null> {
    const abs = this.resolveKey(key);
    return existsSync(abs) ? readFileSync(abs) : null;
  }

  async delete(key: string): Promise<void> {
    rmSync(this.resolveKey(key), { force: true });
  }

  async list(prefix = ""): Promise<string[]> {
    const keys: string[] = [];
    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs);
        else keys.push(path.relative(this.root, abs).split(path.sep).join("/"));
      }
    };
    walk(this.root);
    return keys.filter((k) => k.startsWith(prefix)).sort();
  }
}

/**
 * Object-store seam: local (dev) → s3 (prod). The S3 driver lands with its
 * bucket (Sprint 3+); until then OBJECT_STORE=s3 fails loud.
 */
export function getObjectStore(): ObjectStore {
  const seams = resolveSeams();
  if (seams.objectStore === "s3") {
    throw new Error(
      "OBJECT_STORE=s3 but the S3 driver is not wired yet (lands Sprint 3+). Set OBJECT_STORE=local.",
    );
  }
  return new LocalObjectStore(path.resolve(seams.dataDir, "objects"));
}
