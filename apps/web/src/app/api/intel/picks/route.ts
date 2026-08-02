import { NextResponse } from "next/server";
import { listIntelCaptures } from "@/lib/intel/store";
import type { CreateFamily, IntelPickWire } from "@/lib/intel/types";

/**
 * The pipeline board's Intel-picks read (s91 board sheet: the column holds
 * PICKS only). A pick is a `trend_promote` capture; this route projects the
 * capture store — the same in-memory fake-driver seat the promote/dismiss
 * doors write through (durable capture rows = the next contract window, per
 * the store's own note) — so the board shows exactly what was picked this
 * session, and an empty list on a fresh process is TRUE, not a bug.
 */
export async function GET() {
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  const picks: IntelPickWire[] = listIntelCaptures()
    .filter((capture) => capture.kind === "trend_promote")
    .map((capture) => ({
      captureId: capture.id,
      at: capture.at,
      // The operator's picked title where the dossier had one, else the
      // item's own text — never an invented headline (board-model precedent).
      title: str(capture.payload.title) ?? str(capture.payload.text) ?? capture.ref,
      family: (capture.payload.family as CreateFamily) ?? "post",
      score: typeof capture.payload.score === "number" ? capture.payload.score : null,
      source: str(capture.payload.source) ?? "intel",
      thumbnailUrl: str(capture.payload.thumbnailUrl),
    }));
  return NextResponse.json({ picks });
}
