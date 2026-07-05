import { afterEach, describe, expect, it } from "vitest";
import { hostedVendorProvider } from "../hosted-transcript-provider";
import { getTranscriptProvider, registeredTranscriptProviders } from "../transcript";
import { parseWhisperSegments, whisperLocalProvider } from "../whisper-provider";

afterEach(() => {
  delete process.env.TRANSCRIPT_PROVIDER;
});

describe("transcript provider registry (B4.8 — env-selected drivers)", () => {
  it("defaults to the zero-dep caption-file driver", () => {
    expect(getTranscriptProvider().name).toBe("caption-file");
  });

  it("selects via TRANSCRIPT_PROVIDER env, explicit name winning over env", () => {
    process.env.TRANSCRIPT_PROVIDER = "whisper-local";
    expect(getTranscriptProvider().name).toBe("whisper-local");
    expect(getTranscriptProvider("hosted-vendor").name).toBe("hosted-vendor");
  });

  it("fails loud on unknown providers, listing the registry", () => {
    expect(() => getTranscriptProvider("audio-ripper")).toThrow(
      /unknown transcript provider "audio-ripper" — registered: caption-file, whisper-local, hosted-vendor/,
    );
    expect(registeredTranscriptProviders()).toEqual(["caption-file", "whisper-local", "hosted-vendor"]);
  });
});

describe("whisper-local driver skeleton (B4.8)", () => {
  it("parses faster-whisper JSON into TimedSegments (seconds → ms, trimmed, empties dropped)", () => {
    const stdout = JSON.stringify({
      segments: [
        { start: 0, end: 2.5, text: "  Hello there. " },
        { start: 2.5, end: 3.1, text: "   " },
        { start: 3.1, end: 5, text: "Second line." },
      ],
    });
    expect(parseWhisperSegments(stdout)).toEqual([
      { startMs: 0, endMs: 2500, text: "Hello there." },
      { startMs: 3100, endMs: 5000, text: "Second line." },
    ]);
  });

  it("rejects non-JSON and shape-invalid runner output loudly", () => {
    expect(() => parseWhisperSegments("Traceback (most recent call last):")).toThrow(/non-JSON/);
    expect(() => parseWhisperSegments('{"segments":[{"start":-1,"end":2,"text":"x"}]}')).toThrow();
  });

  it("transcribes a LOCAL media path through the injected runner", async () => {
    const paths: string[] = [];
    const provider = whisperLocalProvider({
      runner: {
        run: async (mediaPath) => {
          paths.push(mediaPath);
          return JSON.stringify({ segments: [{ start: 0, end: 1, text: "ok" }] });
        },
      },
    });
    const segments = await provider.fetchTranscript({ uri: "C:/media/own-pillar.mp4" });
    expect(segments).toEqual([{ startMs: 0, endMs: 1000, text: "ok" }]);
    expect(paths).toEqual(["C:/media/own-pillar.mp4"]);
  });

  it("REFUSES remote URLs — operator-owned local media only (A5/A8 invariant)", async () => {
    const provider = whisperLocalProvider({ runner: { run: async () => "never called" } });
    await expect(provider.fetchTranscript({ uri: "https://platform.test/watch?v=abc" })).rejects.toThrow(
      /refuses remote URLs .* hosted-vendor adapter/,
    );
    await expect(provider.fetchTranscript({})).rejects.toThrow(/requires `uri`/);
  });
});

describe("hosted-vendor adapter skeleton (B4.8)", () => {
  it("fails loud without keyed runtime config — no vendor is baked in", async () => {
    const provider = hostedVendorProvider({ config: {} });
    await expect(provider.fetchTranscript({ uri: "https://platform.test/v/1" })).rejects.toThrow(
      /not configured — set TRANSCRIPT_VENDOR_URL and TRANSCRIPT_VENDOR_API_KEY/,
    );
  });

  it("POSTs the media URL with the bearer key and maps the seam-shaped response", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const provider = hostedVendorProvider({
      config: { url: "https://vendor.test/transcribe", apiKey: "k-123" },
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(
          JSON.stringify({ segments: [{ startMs: 0, endMs: 900, text: " Hook line. " }] }),
          { status: 200 },
        );
      }) as typeof fetch,
    });
    const segments = await provider.fetchTranscript({ uri: "https://platform.test/v/1" });
    expect(segments).toEqual([{ startMs: 0, endMs: 900, text: "Hook line." }]);
    expect(calls[0].url).toBe("https://vendor.test/transcribe");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer k-123");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ mediaUrl: "https://platform.test/v/1" });
  });

  it("surfaces vendor errors loudly", async () => {
    const provider = hostedVendorProvider({
      config: { url: "https://vendor.test/transcribe", apiKey: "k-123" },
      fetchImpl: (async () => new Response("nope", { status: 402 })) as typeof fetch,
    });
    await expect(provider.fetchTranscript({ uri: "https://platform.test/v/1" })).rejects.toThrow(
      /responded 402/,
    );
  });
});
