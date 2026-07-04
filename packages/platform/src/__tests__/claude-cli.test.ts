import { describe, expect, it } from "vitest";
import {
  claudeCliModelAlias,
  isClaudeCliModel,
  parseCandidateJson,
  parseClaudeCliEnvelope,
  runClaudeCliJson,
} from "../claude-cli";

describe("claude-cli dev transport (keyless, processless)", () => {
  it("recognizes claude-cli/* model ids and extracts the alias", () => {
    expect(isClaudeCliModel("claude-cli/sonnet")).toBe(true);
    expect(isClaudeCliModel("anthropic/claude-sonnet-4.5")).toBe(false);
    expect(isClaudeCliModel("openai/gpt-4o-mini")).toBe(false);
    expect(claudeCliModelAlias("claude-cli/sonnet")).toBe("sonnet");
    expect(claudeCliModelAlias("claude-cli/claude-opus-4-8")).toBe("claude-opus-4-8");
  });

  it("runs a call through the injected exec and returns text + billed token usage", async () => {
    const seen: { args?: string[]; stdin?: string } = {};
    const result = await runClaudeCliJson({
      model: "claude-cli/sonnet",
      system: "you are a judge",
      prompt: "DRAFT: hello",
      exec: async (args, stdin) => {
        seen.args = args;
        seen.stdin = stdin;
        return JSON.stringify({
          subtype: "success",
          is_error: false,
          result: '{"verdict":"pass","claims":[]}',
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_creation_input_tokens: 3,
            cache_read_input_tokens: 2,
          },
        });
      },
    });
    expect(result.text).toBe('{"verdict":"pass","claims":[]}');
    // Cache reads/writes are billed input — they count toward the budget cap.
    expect(result.tokensIn).toBe(15);
    expect(result.tokensOut).toBe(5);
    expect(seen.args).toContain("--model");
    expect(seen.args).toContain("sonnet");
    expect(seen.args).toContain("--max-turns");
    expect(seen.stdin).toContain("you are a judge");
    expect(seen.stdin).toContain("DRAFT: hello");
  });

  it("fails loud on an error envelope and on non-JSON CLI output", () => {
    expect(() =>
      parseClaudeCliEnvelope(JSON.stringify({ subtype: "error_max_turns", is_error: true })),
    ).toThrow(/claude CLI call failed/);
    expect(() => parseClaudeCliEnvelope("not json at all")).toThrow(/non-JSON output/);
  });

  it("extracts a JSON candidate from plain, fenced, and prose-wrapped responses", () => {
    expect(parseCandidateJson('{"body":"x"}')).toEqual({ body: "x" });
    expect(parseCandidateJson('```json\n{"body":"x"}\n```')).toEqual({ body: "x" });
    expect(parseCandidateJson('Here you go:\n{"body":"x"}\nHope that helps!')).toEqual({
      body: "x",
    });
    expect(() => parseCandidateJson("no object here")).toThrow(/no JSON object found/);
  });
});
