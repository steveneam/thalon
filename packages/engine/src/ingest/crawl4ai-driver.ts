import { spawn } from "node:child_process";
import { z } from "zod";
import type { WebIngestDriver } from "./web-ingest";

/**
 * B6.6: the Crawl4AI web-ingest driver — Crawl4AI (Apache-2.0, verified at
 * adoption 2026-07-07; installed USER-SCOPE via pip on the operator's
 * machine, never a repo dependency) behind the same subprocess contract as
 * B4.8's whisper-local: the engine knows a python snippet and a JSON stdout
 * shape (`{"content": string}`), never imports the library. Tests inject a
 * fake runner so CI never needs the install; `robots.txt` and rate limits
 * are enforced by the CORE caller (./ingest-web-url.ts) before this driver
 * ever runs.
 */

const crawl4aiOutputSchema = z.object({ content: z.string() });

/**
 * Parses the runner's stdout into the seam's page shape. Crawl4AI's console
 * logging is chatty, so the contract line is the LAST stdout line that
 * parses as the expected JSON object — earlier lines are progress noise.
 * Pure — fixture-tested.
 */
export function parseCrawl4aiOutput(stdout: string): string {
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().startsWith("{"));
  for (let i = lines.length - 1; i >= 0; i--) {
    let candidate: unknown;
    try {
      candidate = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const parsed = crawl4aiOutputSchema.safeParse(candidate);
    if (parsed.success) return parsed.data.content;
  }
  throw new Error(
    `crawl4ai runner emitted no {"content": string} JSON line (${stdout.slice(0, 160)}…) — is the user-scope install intact?`,
  );
}

/** Shells the actual crawl — injectable so tests never touch python or the network. */
export interface Crawl4aiRunner {
  /** Returns the stdout of a crawl4ai run over one URL. */
  run(url: string): Promise<string>;
}

const PYTHON_SNIPPET = [
  "import asyncio, json, sys",
  "from crawl4ai import AsyncWebCrawler",
  "async def main():",
  "    async with AsyncWebCrawler(verbose=False) as crawler:",
  "        result = await crawler.arun(url=sys.argv[1])",
  '        print(json.dumps({"content": str(result.markdown or "")}))',
  "asyncio.run(main())",
].join("\n");

function defaultRunner(pythonCommand: string): Crawl4aiRunner {
  return {
    run(url: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const child = spawn(pythonCommand, ["-c", PYTHON_SNIPPET, url], { windowsHide: true });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));
        child.on("error", (err) =>
          reject(new Error(`crawl4ai runner failed to spawn ${pythonCommand}: ${err.message}`)),
        );
        child.on("close", (code) => {
          if (code === 0) resolve(stdout);
          else reject(new Error(`crawl4ai runner exited ${code}: ${stderr.slice(0, 500)}`));
        });
      });
    },
  };
}

export interface Crawl4aiDriverDeps {
  runner?: Crawl4aiRunner;
  /** The interpreter carrying the user-scope install (default "python"). */
  pythonCommand?: string;
}

export function crawl4aiDriver(deps: Crawl4aiDriverDeps = {}): WebIngestDriver {
  const runner = deps.runner ?? defaultRunner(deps.pythonCommand ?? "python");
  return {
    name: "crawl4ai",
    async fetchPage(request) {
      return { content: parseCrawl4aiOutput(await runner.run(request.url)) };
    },
  };
}
