import { asJson } from "@/lib/approve-queue/client";
import type { IngestResponse, LibraryPayload, TranscriptPayload } from "./types";

export async function fetchLibrary(): Promise<LibraryPayload> {
  return asJson<LibraryPayload>(await fetch("/api/library"));
}

export async function ingestVideo(input: {
  url: string;
  captions?: string;
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
