import { NextResponse } from "next/server";
import { listCapturesOfKind } from "@/lib/intel/captures";
import type { CreateFamily, IntelPickWire } from "@/lib/intel/types";

/**
 * The pipeline board's Intel-picks read (s91 board sheet: the column holds
 * PICKS only). A pick is a `trend_promote` capture, and since s102 those are
 * durable rows — so the board shows what this workspace has picked, not what
 * one process happened to remember. The read is bounded and filtered in SQL
 * (the Bounded-List Rule: the door caps too); an empty list means nothing has
 * been picked, which is the only thing it has ever been allowed to mean.
 */
export async function GET() {
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  const picks: IntelPickWire[] = (await listCapturesOfKind("trend_promote"))
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
