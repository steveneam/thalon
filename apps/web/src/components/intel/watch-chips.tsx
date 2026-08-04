"use client";

import { useState } from "react";
import type { WatchView } from "@/components/intel/intel-model";

/**
 * The watching band, ported 1:1 from Intel.dc.html: the label, one chip per
 * monitored area, and the dashed "+ Add area or keyword" chip. That IS the
 * resting chrome — the area doors (add · pause/resume · edit the description
 * that drives the ranking) live BEHIND it, appearing only once the operator
 * engages a chip, so the sheet's geometry is untouched at rest.
 *
 * An area PAUSES, never deletes (Four-Verbs "Remove" dress — the history is
 * kept and the chip stays visible, quieted, with resume as its ×).
 */
export function WatchChips({
  areas,
  busy,
  onCreate,
  onSetPaused,
  onDescribe,
}: {
  areas: WatchView[];
  busy?: boolean;
  onCreate?: (input: { name: string; description: string }) => Promise<void>;
  onSetPaused?: (areaId: string, paused: boolean) => void;
  onDescribe?: (areaId: string, description: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const editing = editingId ? areas.find((a) => a.id === editingId) : undefined;

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await onCreate?.({ name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t add the area.");
    }
  }

  async function submitEdit(areaId: string) {
    setError(null);
    try {
      await onDescribe?.(areaId, editDescription.trim());
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t update the area.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="t-label" style={{ marginRight: 2 }}>
          Watching
        </span>
        {areas.map((area) => (
          <span key={area.id} className={area.paused ? "watch-chip paused" : "watch-chip"}>
            <button
              type="button"
              className="pick-hit"
              title={area.description}
              aria-expanded={editingId === area.id}
              disabled={busy}
              onClick={() => {
                setEditingId(editingId === area.id ? null : area.id);
                setEditDescription(area.description);
              }}
            >
              {area.name}
              {area.paused && " · paused"}
            </button>
            {/*
              THE GLYPH SAID THE OPPOSITE OF THE VERB (s100 gate). This control
              pauses — history is kept, the chip stays — but it wore `×`, the
              universal destroy mark, so the one reversible verb on the band
              read as the one destructive one. The prose ("An area PAUSES,
              never deletes") was right and invisible; the mark is what the
              operator actually reads. Pause/resume glyphs now, and the pair is
              symmetric so neither state looks like the odd one out.
            */}
            <button
              type="button"
              className="x"
              disabled={busy || !onSetPaused}
              aria-label={area.paused ? `Resume watching ${area.name}` : `Pause watching ${area.name}`}
              title={area.paused ? "Resume this area" : "Pause this area — history is kept"}
              onClick={() => onSetPaused?.(area.id, !area.paused)}
            >
              {area.paused ? "▶" : "❙❙"}
            </button>
          </span>
        ))}
        <button
          type="button"
          className="watch-chip watch-add"
          aria-expanded={adding}
          disabled={busy || !onCreate}
          onClick={() => setAdding((current) => !current)}
        >
          + Add area or keyword
        </button>
      </div>

      {adding && (
        <form onSubmit={submitCreate} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            className="input"
            aria-label="Area name"
            placeholder="Area name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: 220 }}
          />
          <input
            className="input"
            aria-label="Area description"
            placeholder="What to watch, in your own words — this drives the ranking"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={busy || !name.trim() || !description.trim()}
          >
            Add area
          </button>
        </form>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            className="input"
            aria-label={`Description for ${editing.name}`}
            rows={2}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || !editDescription.trim() || !onDescribe}
              onClick={() => submitEdit(editing.id)}
            >
              Save
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
            <span className="t-label">
              This description drives the ranking — the richer it is, the better the cards.
            </span>
          </div>
        </div>
      )}

      {error && (
        <span className="t-label" style={{ color: "var(--err)" }} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
