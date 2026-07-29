import { asJson } from "@/lib/approve-queue/client";
import type { IngestResponse, LibraryPayload, TranscriptPayload } from "./types";

export async function fetchLibrary(): Promise<LibraryPayload> {
  return asJson<LibraryPayload>(await fetch("/api/library"));
}

export async function ingestVideo(input: {
  url: string;
  captions?: string;
  tags?: string[];
  /**
   * The operator's per-ingest AI-enhance choice (s79). Omitted ⇒ free: the
   * default lives once, engine-side, so no client can accidentally become the
   * thing that starts the spending.
   */
  aiEnhance?: boolean;
}): Promise<IngestResponse> {
  const res = await fetch("/api/library/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return asJson<IngestResponse>(res);
}

export async function fetchTranscript(sourceId: string): Promise<TranscriptPayload> {
  return asJson<TranscriptPayload>(
    await fetch(`/api/library/${encodeURIComponent(sourceId)}/transcript`),
  );
}

export async function deleteSource(sourceId: string): Promise<{ deleted: boolean }> {
  return asJson<{ deleted: boolean }>(
    await fetch(`/api/library/${encodeURIComponent(sourceId)}`, { method: "DELETE" }),
  );
}
