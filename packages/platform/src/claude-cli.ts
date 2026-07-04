import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

/**
 * DEV-ONLY model transport: routes a model tier through the local Claude
 * Code CLI (`claude -p`, headless mode) on the operator's own subscription
 * instead of the AI gateway. Selected purely by runtime config — set a tier
 * to `claude-cli/<alias>` (e.g. `MODEL_JUDGE_FINAL=claude-cli/sonnet` in
 * .env.local) and the shell drivers dispatch here; no code changes, no
 * gateway credits. Exists for the build/test phase ONLY (headless Claude
 * Code is a sanctioned dev-tooling use of a subscription; serving an
 * application's production traffic through it is not) — production tiers
 * stay on gateway model IDs. Embeddings can NOT use this transport (Claude
 * has no embedding models); the embedding tier always goes to the gateway.
 * Calls made through here still return token usage, so `withGatewayGuard`
 * metering and per-tenant budget caps keep working unchanged.
 */
const CLAUDE_CLI_PREFIX = "claude-cli/";
const CLI_TIMEOUT_MS = 180_000;

export function isClaudeCliModel(modelId: string): boolean {
  return modelId.startsWith(CLAUDE_CLI_PREFIX);
}

/** `claude-cli/sonnet` -> `sonnet` (whatever alias/full id the CLI's --model accepts). */
export function claudeCliModelAlias(modelId: string): string {
  return modelId.slice(CLAUDE_CLI_PREFIX.length);
}

export interface ClaudeCliResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

/** Injectable process runner so tests never spawn the real CLI (keyless + processless suite). */
export type ClaudeCliExec = (args: string[], stdin: string) => Promise<string>;

function spawnClaudeCli(args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // A neutral cwd keeps the call a plain LLM request: no project
    // CLAUDE.md, settings, or hooks from whatever repo the caller runs in.
    // Windows: `claude` is an npm .cmd shim Node refuses to spawn without a
    // shell (CVE-2024-27980); an args array alongside shell:true triggers
    // DEP0190, so join the (alias-validated, literal) parts ourselves.
    const child =
      process.platform === "win32"
        ? spawn(["claude", ...args].join(" "), { cwd: tmpdir(), shell: true, windowsHide: true })
        : spawn("claude", args, { cwd: tmpdir(), windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude CLI timed out after ${CLI_TIMEOUT_MS}ms`));
    }, CLI_TIMEOUT_MS);
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`claude CLI failed to start (is Claude Code installed?): ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`claude CLI exited ${code}: ${stderr.slice(0, 300) || stdout.slice(0, 300)}`));
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

/**
 * One CLI invocation = one model call. The system prompt is folded into the
 * stdin prompt (headless single-turn; --max-turns 1 stops any agentic
 * follow-up). Returns the raw response text plus token usage from the CLI's
 * JSON envelope — callers extract/validate their candidate through the same
 * Zod boundary as gateway output.
 */
export async function runClaudeCliJson(opts: {
  model: string;
  system: string;
  prompt: string;
  exec?: ClaudeCliExec;
}): Promise<ClaudeCliResult> {
  const exec = opts.exec ?? spawnClaudeCli;
  const alias = claudeCliModelAlias(opts.model);
  // Every spawn argument must stay shell-safe (Windows path joins a command
  // string): the alias is the only non-literal, so pin its charset.
  if (!/^[A-Za-z0-9._/-]+$/.test(alias)) {
    throw new Error(`invalid claude-cli model alias "${alias}"`);
  }
  const args = ["-p", "--output-format", "json", "--model", alias, "--max-turns", "1"];
  const stdin = [
    "SYSTEM INSTRUCTIONS:",
    opts.system,
    "",
    "Respond with ONLY the JSON object requested — no prose, no markdown fences, no tool use.",
    "",
    opts.prompt,
  ].join("\n");
  const raw = await exec(args, stdin);
  return parseClaudeCliEnvelope(raw);
}

/** Parses `claude -p --output-format json` output. Exported for tests. */
export function parseClaudeCliEnvelope(raw: string): ClaudeCliResult {
  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`claude CLI produced non-JSON output: ${raw.slice(0, 200)}`);
  }
  if (envelope.is_error || envelope.subtype !== "success" || typeof envelope.result !== "string") {
    throw new Error(`claude CLI call failed: ${JSON.stringify(envelope).slice(0, 300)}`);
  }
  const usage = (envelope.usage ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number => (typeof v === "number" ? v : 0);
  return {
    text: envelope.result,
    // Cache reads/writes are still billed input — count them toward the budget.
    tokensIn:
      num(usage.input_tokens) +
      num(usage.cache_creation_input_tokens) +
      num(usage.cache_read_input_tokens),
    tokensOut: num(usage.output_tokens),
  };
}

/**
 * Pulls the JSON candidate out of a model's text response (tolerates
 * markdown fences and surrounding prose). Throws on anything unparseable —
 * in a shell driver that consumes one bounded repair attempt, exactly like
 * a schema-invalid gateway candidate.
 */
export function parseCandidateJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error(`no JSON object found in claude CLI response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(body.slice(start, end + 1));
}
