"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMsAsClock } from "@/lib/approve-queue/formats/clip-plan";
import { buildFieldPatchOps, buildSceneReorderOps, pointer, type Rfc6902Op } from "@/lib/staged-flow/patch";
import type { StagedEditKind, StoryboardContent } from "@/lib/staged-flow/types";

interface StoryboardCardsProps {
  content: StoryboardContent;
  busy: boolean;
  /** Scene indexes the operator has explicitly accepted for THIS artifact version (parent keys by draft+bodyHash). */
  accepted: ReadonlySet<number>;
  onEdit: (kind: StagedEditKind, patch: Rfc6902Op[], note?: string) => void;
  /** Per-beat accept: parent records the capture (empty patch) AND tracks the chip state by scene index. */
  onAccept: (sceneIndex: number) => void;
}

interface SceneDraftFields {
  heading: string;
  narration: string;
  onScreenText: string;
  visualHint: string;
  durationHintMs: string;
}

/**
 * Storyboard cards (the structure stage's artifact): one card per scene
 * with reorder controls and per-beat accept/tweak chips. Every interaction
 * leaves as a verbatim RFC-6902 patch via onEdit — reorders as a move op
 * plus the contract's sceneIndex repairs, tweaks as add/remove/replace ops
 * on exactly the changed fields, accepts as the explicit empty patch.
 */
export function StoryboardCards({ content, busy, accepted, onEdit, onAccept }: StoryboardCardsProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [fields, setFields] = useState<SceneDraftFields | null>(null);

  function startTweak(index: number) {
    const scene = content.scenes[index];
    setEditingIndex(index);
    setFields({
      heading: scene.heading,
      narration: scene.narration,
      onScreenText: scene.onScreenText ?? "",
      visualHint: scene.visualHint ?? "",
      durationHintMs: scene.durationHintMs === undefined ? "" : String(scene.durationHintMs),
    });
  }

  function saveTweak() {
    if (editingIndex === null || !fields) return;
    const scene = content.scenes[editingIndex];
    const duration = fields.durationHintMs.trim() === "" ? undefined : Number(fields.durationHintMs);
    const ops = buildFieldPatchOps(
      pointer("scenes", editingIndex),
      {
        heading: scene.heading,
        narration: scene.narration,
        onScreenText: scene.onScreenText,
        visualHint: scene.visualHint,
        durationHintMs: scene.durationHintMs,
      },
      {
        heading: fields.heading.trim(),
        narration: fields.narration.trim(),
        onScreenText: fields.onScreenText.trim() === "" ? undefined : fields.onScreenText.trim(),
        visualHint: fields.visualHint.trim() === "" ? undefined : fields.visualHint.trim(),
        durationHintMs: Number.isFinite(duration) ? duration : undefined,
      },
    );
    setEditingIndex(null);
    setFields(null);
    if (ops.length > 0) onEdit("tweak", ops, `scene ${editingIndex + 1}`);
  }

  const set = (field: keyof SceneDraftFields) => (value: string) =>
    setFields((prev) => (prev ? { ...prev, [field]: value } : prev));

  return (
    <div aria-label="Storyboard cards" role="group" className="flex flex-col gap-2">
      {content.scenes.map((scene, i) => {
        const editing = editingIndex === i && fields;
        return (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                <span className="mr-1.5 text-xs text-muted-foreground">Scene {i + 1}</span>
                {scene.heading}
              </h4>
              <span className="flex items-center gap-1">
                {scene.durationHintMs !== undefined && (
                  <Badge variant="outline">{formatMsAsClock(scene.durationHintMs)}</Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || i === 0 || editingIndex !== null}
                  aria-label={`Move scene ${i + 1} up`}
                  onClick={() => onEdit("reorder", buildSceneReorderOps(content.scenes.length, i, i - 1), `scene ${i + 1} → ${i}`)}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || i === content.scenes.length - 1 || editingIndex !== null}
                  aria-label={`Move scene ${i + 1} down`}
                  onClick={() => onEdit("reorder", buildSceneReorderOps(content.scenes.length, i, i + 1), `scene ${i + 1} → ${i + 2}`)}
                >
                  ↓
                </Button>
              </span>
            </div>
            {editing ? (
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Heading</span>
                  <input
                    aria-label={`Scene ${i + 1} heading`}
                    className="rounded-md border border-border bg-background p-1.5 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={fields.heading}
                    onChange={(e) => set("heading")(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Narration (the judged claim surface)</span>
                  <textarea
                    aria-label={`Scene ${i + 1} narration`}
                    className="min-h-16 rounded-md border border-border bg-background p-1.5 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={fields.narration}
                    onChange={(e) => set("narration")(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">On-screen text (blank = none)</span>
                  <input
                    aria-label={`Scene ${i + 1} on-screen text`}
                    className="rounded-md border border-border bg-background p-1.5 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={fields.onScreenText}
                    onChange={(e) => set("onScreenText")(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Visual hint (seeds the scenes stage, blank = none)</span>
                  <input
                    aria-label={`Scene ${i + 1} visual hint`}
                    className="rounded-md border border-border bg-background p-1.5 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={fields.visualHint}
                    onChange={(e) => set("visualHint")(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Duration hint ms (blank = derive from narration)</span>
                  <input
                    type="number"
                    min={1}
                    step={500}
                    aria-label={`Scene ${i + 1} duration hint`}
                    className="w-40 rounded-md border border-border bg-background p-1.5 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={fields.durationHintMs}
                    onChange={(e) => set("durationHintMs")(e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveTweak}
                    disabled={busy || fields.heading.trim() === "" || fields.narration.trim() === ""}
                  >
                    Save tweak
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => { setEditingIndex(null); setFields(null); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-foreground">{scene.narration}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {scene.onScreenText && <span>on-screen: {scene.onScreenText}</span>}
                  {scene.visualHint && <span className="italic">visual hint: {scene.visualHint}</span>}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={accepted.has(i) ? "default" : "outline"}
                    aria-label={`Accept scene ${i + 1}`}
                    aria-pressed={accepted.has(i)}
                    disabled={busy || accepted.has(i)}
                    onClick={() => onAccept(i)}
                  >
                    {accepted.has(i) ? "Accepted ✓" : "Accept"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Tweak scene ${i + 1}`}
                    disabled={busy || editingIndex !== null}
                    onClick={() => startTweak(i)}
                  >
                    Tweak
                  </Button>
                </div>
              </>
            )}
          </div>
        );
      })}
      {content.cta && (
        <p className="text-sm text-muted-foreground">
          CTA: <span className="text-foreground">{content.cta}</span>
        </p>
      )}
    </div>
  );
}
