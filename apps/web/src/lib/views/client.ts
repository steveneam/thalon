import { asJson } from "@/lib/approve-queue/client";

/**
 * Saved-views client (Phase-I window store, wired s62): the tenant-wide
 * `saved_views` table is the system of record for board/calendar view tabs —
 * the client machine only ever holds copies (the storage-story rule).
 */

export interface WireView {
  id: string;
  surface: string;
  name: string;
  config: Record<string, unknown>;
  position: number;
}

export async function fetchViews(surface: string): Promise<WireView[]> {
  const { views } = await asJson<{ views: WireView[] }>(
    await fetch(`/api/views?surface=${encodeURIComponent(surface)}`),
  );
  return views;
}

/** Idempotent save-view snapshot — upserts by (surface, name) server-side. */
export async function putView(
  surface: string,
  name: string,
  config: Record<string, unknown>,
): Promise<WireView> {
  const { view } = await asJson<{ view: WireView }>(
    await fetch("/api/views", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface, name, config }),
    }),
  );
  return view;
}
