import { spawn } from "node:child_process";
import { z } from "zod";
import type { TimedSegment } from "./captions";
import type { TranscriptProvider } from "./transcript";

/**
 * B4.8 (B3.13 pass-2 thin cut): the self-hosted Whisper driver skeleton —
 * faster-whisper (MIT) on the operator's machine, for OPERATOR-OWNED or
 * permitted media files ONLY. The A5/A8 invariant is structural here: this
 * provider refuses remote URLs outright — the engine never fetches
 * third-party media or rips platform audio; remote third-party transcripts
 * go through the hosted-vendor adapter (the vendor absorbs platform-ToS
 * risk). Live transcription runs are pass-3 work: tests inject a fake
 * runner; `npm run doctor` reports whether the real runtime is installed.
 */

const whisperSegmentSchema = z.object({
  /** Seconds, as faster-whisper emits them. */
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
});

const whisperOutputSchema = z.object({ segments: z.array(whisperSegmentSchema) });

/** Parses the runner's JSON stdout into the seam's TimedSegment shape (seconds → ms, whitespace trimmed, empty segments dropped). Pure — fixture-tested. */
export function parseWhisperSegments(stdout: string): TimedSegment[] {
  let candidate: unknown;
  try {
    candidate = JSON.parse(stdout);
  } catch {
    throw new Error(
      `whisper runner emitted non-JSON output (${stdout.slice(0, 120)}…) — expected {"segments":[{start,end,text}]}`,
    );
  }
  const parsed = whisperOutputSchema.parse(candidate);
  return parsed.segments
    .map((segment) => ({
      startMs: Math.round(segment.start * 1000),
      endMs: Math.round(segment.end * 1000),
      text: segment.text.trim(),
    }))
    .filter((segment) => segment.text.length > 0);
}

/** Shells the actual transcription — injectable so tests never transcribe. */
export interface WhisperRunner {
  /** Returns the JSON stdout of a faster-whisper run over a LOCAL media file. */
  run(mediaPath: string): Promise<string>;
}

const PYTHON_SNIPPET = [
  "import json,sys",
  "from faster_whisper import WhisperModel",
  'segs,_=WhisperModel("tiny").transcribe(sys.argv[1],word_timestamps=False)',
  'print(json.dumps({"segments":[{"start":s.start,"end":s.end,"text":s.text} for s in segs]}))',
].join(";");

function defaultRunner(): WhisperRunner {
  return {
    run(mediaPath: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const child = spawn("python", ["-c", PYTHON_SNIPPET, mediaPath], { windowsHide: true });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));
        child.on("error", (err) => reject(new Error(`whisper runner failed to spawn python: ${err.message}`)));
        child.on("close", (code) => {
          if (code === 0) resolve(stdout);
          else reject(new Error(`whisper runner exited ${code}: ${stderr.slice(0, 500)}`));
        });
      });
    },
  };
}

export function whisperLocalProvider(deps: { runner?: WhisperRunner } = {}): TranscriptProvider {
  const runner = deps.runner ?? defaultRunner();
  return {
    name: "whisper-local",
    async fetchTranscript(request) {
      if (!request.uri) {
        throw new Error(
          'transcript provider "whisper-local" requires `uri` — the path to an operator-owned local media file',
        );
      }
      if (/^https?:\/\//i.test(request.uri)) {
        throw new Error(
          `transcript provider "whisper-local" refuses remote URLs ("${request.uri}") — it transcribes operator-owned LOCAL media only; third-party videos go through the hosted-vendor adapter (A5/A8)`,
        );
      }
      return parseWhisperSegments(await runner.run(request.uri));
    },
  };
}
