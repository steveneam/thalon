"use client";

import { useRef, useState } from "react";
import {
  DIRECTION_ASPECTS,
  DIRECTION_MOTIONS,
  DIRECTION_PACINGS,
  DirectionMdParseError,
  parseDirectionMd,
  renderDirectionMd,
  type DirectionDoc,
  type DirectionScene,
} from "@thalon/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMsAsClock } from "@/lib/approve-queue/formats/clip-plan";
import { buildFieldPatchOps, diffDirectionDocs, pointer, type Rfc6902Op } from "@/lib/staged-flow/patch";
import type { StagedEditKind, StylePreset } from "@/lib/staged-flow/types";

/**
 * The direction editor (B5.4): a FORM view and a RAW strict-md view over
 * the SAME schema — renderDirectionMd/parseDirectionMd live in
 * @thalon/contracts precisely so this needs no engine dependency, and the
 * byte-identical round-trip means the two views can never drift. Raw-view
 * parse errors surface verbatim with their line numbers
 * (DirectionMdParseError.line). Every commit leaves as a verbatim RFC-6902
 * patch: form tweaks as per-field replaces, presets as style-field
 * replaces, raw applies as the structured diff between old and new doc.
 */

interface DirectionEditorProps {
  doc: DirectionDoc;
  /** Changes whenever the artifact changes (the draft's bodyHash) — resets form/raw local state via key remounts. */
  docKey: string;
  presets: StylePreset[];
  busy: boolean;
  accepted: ReadonlySet<number>;
  onEdit: (kind: StagedEditKind, patch: Rfc6902Op[], note?: string) => void;
  onAccept: (sceneIndex: number) => void;
}

export function DirectionEditor({ doc, docKey, presets, busy, accepted, onEdit, onAccept }: DirectionEditorProps) {
  const [mode, setMode] = useState<"form" | "raw">("form");

  function applyPreset(preset: StylePreset) {
    const ops: Rfc6902Op[] = [];
    if (preset.aspect && preset.aspect !== doc.aspect) ops.push({ op: "replace", path: "/aspect", value: preset.aspect });
    if (preset.fps !== undefined && preset.fps !== doc.fps) ops.push({ op: "replace", path: "/fps", value: preset.fps });
    if (preset.pacing && preset.pacing !== doc.pacing) ops.push({ op: "replace", path: "/pacing", value: preset.pacing });
    if (preset.motion) {
      doc.scenes.forEach((scene, i) => {
        if (scene.motion !== preset.motion) {
          ops.push({ op: "replace", path: pointer("scenes", i, "motion"), value: preset.motion });
        }
      });
    }
    if (ops.length > 0) onEdit("preset", ops, preset.key);
  }

  return (
    <div aria-label="Direction editor" role="group" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Editor view">
          <Button size="sm" variant={mode === "form" ? "default" : "outline"} aria-pressed={mode === "form"} onClick={() => setMode("form")}>
            Form
          </Button>
          <Button size="sm" variant={mode === "raw" ? "default" : "outline"} aria-pressed={mode === "raw"} onClick={() => setMode("raw")}>
            Raw direction.md
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Style presets">
          <span className="text-xs text-muted-foreground">Profile presets:</span>
          {presets.map((preset) => (
            <Button
              key={preset.key}
              size="sm"
              variant="outline"
              disabled={busy}
              aria-label={`Apply preset ${preset.title}`}
              title={[preset.aspect, preset.fps && `${preset.fps}fps`, preset.pacing, preset.motion].filter(Boolean).join(" · ")}
              onClick={() => applyPreset(preset)}
            >
              {preset.title}
            </Button>
          ))}
        </div>
      </div>
      {mode === "form" ? (
        <FormView key={docKey} doc={doc} busy={busy} accepted={accepted} onEdit={onEdit} onAccept={onAccept} />
      ) : (
        <RawView key={docKey} doc={doc} busy={busy} onEdit={onEdit} />
      )}
    </div>
  );
}

function fieldClass(extra = "") {
  return `rounded-md border border-border bg-background p-1.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${extra}`;
}

interface FormViewProps {
  doc: DirectionDoc;
  busy: boolean;
  accepted: ReadonlySet<number>;
  onEdit: DirectionEditorProps["onEdit"];
  onAccept: (sceneIndex: number) => void;
}

/** Remounted (via key) whenever the doc changes, so local field state always starts from the persisted artifact. */
function FormView({ doc, busy, accepted, onEdit, onAccept }: FormViewProps) {
  const [title, setTitle] = useState(doc.title);
  const [fps, setFps] = useState(String(doc.fps));
  const [cta, setCta] = useState(doc.cta ?? "");

  function commitDocField(changes: Partial<Record<"title" | "aspect" | "fps" | "pacing" | "cta", unknown>>) {
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(changes)) {
      before[field] = doc[field as keyof DirectionDoc];
      after[field] = value;
    }
    const ops = buildFieldPatchOps("", before, after);
    if (ops.length > 0) onEdit("tweak", ops, "document");
  }

  function commitTitle() {
    if (title.trim() === "") {
      setTitle(doc.title);
      return;
    }
    commitDocField({ title: title.trim() });
  }

  function commitFps() {
    const value = Number(fps);
    if (!Number.isInteger(value) || value < 1 || value > 120) {
      setFps(String(doc.fps));
      return;
    }
    commitDocField({ fps: value });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="flex flex-col gap-1 sm:col-span-2 xl:col-span-3">
          <span className="text-xs text-muted-foreground">Title</span>
          <input aria-label="Direction title" className={fieldClass()} value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Aspect (compile-time frame)</span>
          <select aria-label="Aspect" className={fieldClass()} value={doc.aspect} disabled={busy} onChange={(e) => commitDocField({ aspect: e.target.value })}>
            {DIRECTION_ASPECTS.map((aspect) => (
              <option key={aspect} value={aspect}>{aspect}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">FPS</span>
          <input type="number" min={1} max={120} aria-label="FPS" className={fieldClass()} value={fps} disabled={busy} onChange={(e) => setFps(e.target.value)} onBlur={commitFps} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Pacing</span>
          <select aria-label="Pacing" className={fieldClass()} value={doc.pacing} disabled={busy} onChange={(e) => commitDocField({ pacing: e.target.value })}>
            {DIRECTION_PACINGS.map((pacing) => (
              <option key={pacing} value={pacing}>{pacing}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2 xl:col-span-3">
          <span className="text-xs text-muted-foreground">CTA (blank = none)</span>
          <input
            aria-label="CTA"
            className={fieldClass()}
            value={cta}
            disabled={busy}
            onChange={(e) => setCta(e.target.value)}
            onBlur={() => commitDocField({ cta: cta.trim() === "" ? null : cta.trim() })}
          />
        </label>
      </div>
      {doc.scenes.map((scene, i) => (
        <DirectionSceneCard key={`${i}:${scene.narration}`} scene={scene} index={i} busy={busy} accepted={accepted.has(i)} onEdit={onEdit} onAccept={onAccept} />
      ))}
    </div>
  );
}

interface DirectionSceneCardProps {
  scene: DirectionScene;
  index: number;
  busy: boolean;
  accepted: boolean;
  onEdit: DirectionEditorProps["onEdit"];
  onAccept: (sceneIndex: number) => void;
}

function DirectionSceneCard({ scene, index, busy, accepted, onEdit, onAccept }: DirectionSceneCardProps) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    heading: scene.heading,
    narration: scene.narration,
    onScreenText: scene.onScreenText ?? "",
    visual: scene.visual ?? "",
    motion: scene.motion as string,
    durationMs: String(scene.durationMs),
  });

  function startTweak() {
    setFields({
      heading: scene.heading,
      narration: scene.narration,
      onScreenText: scene.onScreenText ?? "",
      visual: scene.visual ?? "",
      motion: scene.motion,
      durationMs: String(scene.durationMs),
    });
    setEditing(true);
  }

  function saveTweak() {
    const duration = Number(fields.durationMs);
    const ops = buildFieldPatchOps(
      pointer("scenes", index),
      {
        heading: scene.heading,
        narration: scene.narration,
        onScreenText: scene.onScreenText,
        visual: scene.visual,
        motion: scene.motion,
        durationMs: scene.durationMs,
      },
      {
        heading: fields.heading.trim(),
        narration: fields.narration.trim(),
        onScreenText: fields.onScreenText.trim() === "" ? null : fields.onScreenText.trim(),
        visual: fields.visual.trim() === "" ? null : fields.visual.trim(),
        motion: fields.motion,
        durationMs: Number.isInteger(duration) && duration > 0 ? duration : scene.durationMs,
      },
    );
    setEditing(false);
    if (ops.length > 0) onEdit("tweak", ops, `scene ${index + 1}`);
  }

  const set = (field: keyof typeof fields) => (value: string) => setFields((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">
          <span className="mr-1.5 text-xs text-muted-foreground">Scene {index + 1}</span>
          {scene.heading}
        </h4>
        <span className="flex items-center gap-1.5">
          <Badge variant="secondary" className="font-mono text-2xs">{scene.motion}</Badge>
          <Badge variant="outline">{formatMsAsClock(scene.durationMs)}</Badge>
        </span>
      </div>
      {editing ? (
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Heading</span>
            <input aria-label={`Scene ${index + 1} heading`} className={fieldClass()} value={fields.heading} onChange={(e) => set("heading")(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Narration (the judged claim surface)</span>
            <textarea aria-label={`Scene ${index + 1} narration`} className={fieldClass("min-h-16")} value={fields.narration} onChange={(e) => set("narration")(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">On-screen text (blank = none)</span>
            <input aria-label={`Scene ${index + 1} on-screen text`} className={fieldClass()} value={fields.onScreenText} onChange={(e) => set("onScreenText")(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Visual direction (blank = none)</span>
            <input aria-label={`Scene ${index + 1} visual`} className={fieldClass()} value={fields.visual} onChange={(e) => set("visual")(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Motion</span>
              <select aria-label={`Scene ${index + 1} motion`} className={fieldClass()} value={fields.motion} onChange={(e) => set("motion")(e.target.value)}>
                {DIRECTION_MOTIONS.map((motion) => (
                  <option key={motion} value={motion}>{motion}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Duration ms</span>
              <input type="number" min={1} step={500} aria-label={`Scene ${index + 1} duration`} className={fieldClass("w-32")} value={fields.durationMs} onChange={(e) => set("durationMs")(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveTweak} disabled={busy || fields.heading.trim() === "" || fields.narration.trim() === ""}>
              Save tweak
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground">{scene.narration}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {scene.onScreenText && <span>on-screen: {scene.onScreenText}</span>}
            <span className="italic">{scene.visual ? `visual: ${scene.visual}` : "visual pending"}</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={accepted ? "default" : "outline"}
              aria-label={`Accept scene ${index + 1}`}
              aria-pressed={accepted}
              disabled={busy || accepted}
              onClick={() => onAccept(index)}
            >
              {accepted ? "Accepted ✓" : "Accept"}
            </Button>
            <Button size="sm" variant="outline" aria-label={`Tweak scene ${index + 1}`} disabled={busy} onClick={startTweak}>
              Tweak
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface RawViewProps {
  doc: DirectionDoc;
  busy: boolean;
  onEdit: DirectionEditorProps["onEdit"];
}

/** Remounted (via key) whenever the doc changes — the textarea re-seeds from the freshly rendered strict md. */
function RawView({ doc, busy, onEdit }: RawViewProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function apply() {
    const raw = textareaRef.current?.value ?? "";
    // Mechanical normalization only (line endings + exactly one trailing
    // newline) — everything else stays as strict as the grammar demands.
    const normalized = raw.replace(/\r\n?/g, "\n").replace(/\n*$/, "\n");
    try {
      const parsed = parseDirectionMd(normalized);
      const ops = diffDirectionDocs(doc, parsed);
      setError(null);
      if (ops.length === 0) {
        setInfo("No changes to apply.");
        return;
      }
      setInfo(null);
      onEdit("raw_md", ops, "raw direction.md edit");
    } catch (err) {
      setInfo(null);
      if (err instanceof DirectionMdParseError) {
        // .message already carries "direction.md line N: …" — the line number the operator needs.
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "could not parse direction.md");
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Strict-schema markdown — the same document as the form view, byte-identical round-trip. Applied edits are
        captured as a structured patch.
      </p>
      <textarea
        ref={textareaRef}
        aria-label="Raw direction.md"
        spellCheck={false}
        rows={Math.min(28, doc.scenes.length * 8 + 10)}
        className={fieldClass("w-full font-mono text-xs leading-relaxed whitespace-pre")}
        defaultValue={renderDirectionMd(doc)}
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="text-xs text-muted-foreground" role="status">
          {info}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={apply}>
          Apply raw edit
        </Button>
      </div>
    </div>
  );
}
