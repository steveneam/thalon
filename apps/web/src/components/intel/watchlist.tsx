"use client";

import { useState } from "react";
import { Play, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AreaRow } from "@/lib/intel/types";

interface WatchlistProps {
  areas: AreaRow[];
  busy: boolean;
  onCreate: (input: { name: string; description: string }) => Promise<void>;
  onUpdate: (
    areaId: string,
    patch: { description?: string; status?: "active" | "paused" },
  ) => Promise<void>;
}

/**
 * Watchlist chips managed in place (Phase D design #4, the AreasManager card
 * recast as the mock's chip row): each monitored area is a chip; × pauses it
 * (Four-Verbs "Remove" dress — areas pause, never delete, history kept);
 * paused chips stay visible muted with a resume affordance; "+ add area or
 * keyword" opens the inline form. Clicking a chip's name opens its
 * description editor — the description stays load-bearing data (the
 * query-expansion seed + relevance-embedding anchor, so the form says so).
 *
 * Data gap, flagged: the design gives auto-discovered chips a bronze "auto"
 * word, but MonitoredAreaConfig carries no origin marker (contract frozen) —
 * no chip can honestly wear it until discovery lands, so none does.
 */
export function Watchlist({ areas, busy, onCreate, onUpdate }: WatchlistProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await onCreate({ name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the area.");
    }
  }

  async function submitEdit(areaId: string) {
    setError(null);
    try {
      await onUpdate(areaId, { description: editDescription.trim() });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the area.");
    }
  }

  const editing = editingId ? areas.find((a) => a.id === editingId) : undefined;

  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="u-eyebrow mr-1 text-muted-foreground">watching</span>
        {areas.map((area) => {
          const paused = area.status === "paused";
          return (
            <span
              key={area.id}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card pr-1 pl-2.5 text-xs",
                paused && "text-muted-foreground",
              )}
            >
              <button
                type="button"
                title={area.description}
                aria-label={`Edit area ${area.name}`}
                aria-expanded={editingId === area.id}
                disabled={busy}
                onClick={() => {
                  setEditingId(editingId === area.id ? null : area.id);
                  setEditDescription(area.description);
                }}
                className="rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {area.name}
              </button>
              {paused ? (
                <>
                  <span className="font-mono text-2xs text-muted-foreground uppercase">paused</span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Resume area ${area.name}`}
                    disabled={busy}
                    onClick={() => onUpdate(area.id, { status: "active" })}
                    className="size-4 rounded-full"
                  >
                    <Play aria-hidden />
                  </Button>
                </>
              ) : (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Pause area ${area.name}`}
                  disabled={busy}
                  onClick={() => onUpdate(area.id, { status: "paused" })}
                  className="size-4 rounded-full text-muted-foreground"
                >
                  <X aria-hidden />
                </Button>
              )}
            </span>
          );
        })}
        <button
          type="button"
          aria-expanded={adding}
          disabled={busy}
          onClick={() => setAdding((current) => !current)}
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          )}
        >
          <Plus aria-hidden className="size-3" /> add area or keyword
        </button>
      </div>

      {adding && (
        <form onSubmit={submitCreate} className="flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="Area name"
            placeholder="Area name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-48"
          />
          <input
            aria-label="Area description"
            placeholder="What to watch, in your own words — this drives the ranking"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
          <Button type="submit" size="sm" disabled={busy || !name.trim() || !description.trim()}>
            <Plus aria-hidden data-icon="inline-start" /> Add area
          </Button>
        </form>
      )}

      {editing && (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label={`Description for ${editing.name}`}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
          <div className="flex items-center gap-2">
            <Button size="xs" disabled={busy || !editDescription.trim()} onClick={() => submitEdit(editing.id)}>
              Save
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <span className="text-xs text-muted-foreground">
              This description drives the ranking — the richer it is, the better the cards.
            </span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
