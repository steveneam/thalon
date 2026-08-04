"use client";

import { useRef, useState } from "react";
import {
  DIRECTION_ASPECTS,
  DIRECTION_PACINGS,
  DirectionMdParseError,
  parseDirectionMd,
  renderDirectionMd,
  type DirectionDoc,
} from "@thalon/contracts";
import { buildFieldPatchOps, diffDirectionDocs, pointer, type Rfc6902Op } from "@/lib/staged-flow/patch";
import type { StagedEditKind, StylePreset } from "@/lib/staged-flow/types";

/**
 * THE DIRECTION FACTS + their editor (s101 rebuild, `Staged.dc.html`).
 *
 * The document's style fields (title / aspect / fps / pacing / CTA) are now
 * CHIPS — value first, label as the small print inside it (the Artlist Studio
 * pattern from the research pass). What shipped was five labelled fields in a
 * `sm:grid-cols-2 xl:grid-cols-3` grid; at the pane's real width those
 * VIEWPORT breakpoints resolved to three 46.7px columns, so "Aspect
 * (compile-time frame)" wrapped to four lines, the title input clipped at
 * 154px of 173, and 240px of the founder's own CTA sentence was simply off
 * the right edge. Chips cannot do that: they size to their content and wrap
 * as a row.
 *
 * The FORM only exists in advanced mode, and only behind "Edit direction".
 * On a live one-prompt chain the old surface rendered the whole editor and
 * hard-`disabled` it — 26 of 41 controls dead on arrival, a working editor's
 * dress over nothing. A live chain now gets facts and one honest line.
 *
 * The strict-md view is unchanged in kind: `renderDirectionMd`/
 * `parseDirectionMd` live in @thalon/contracts precisely so this needs no
 * engine dependency, the byte-identical round-trip means the two views can
 * never drift, and parse errors surface verbatim with their line numbers.
 */

interface DirectionFactsProps {
  doc: DirectionDoc;
  /** Changes whenever the artifact changes (the draft's bodyHash) — resets local state via key remounts. */
  docKey: string;
  presets: StylePreset[];
  editable: boolean;
  busy: boolean;
  onEdit: (kind: StagedEditKind, patch: Rfc6902Op[], note?: string) => void;
}

type Mode = "facts" | "form" | "raw";

export function DirectionFacts({ doc, docKey, presets, editable, busy, onEdit }: DirectionFactsProps) {
  const [mode, setMode] = useState<Mode>("facts");

  function applyPreset(preset: StylePreset) {
    const ops: Rfc6902Op[] = [];
    if (preset.aspect && preset.aspect !== doc.aspect)
      ops.push({ op: "replace", path: "/aspect", value: preset.aspect });
    if (preset.fps !== undefined && preset.fps !== doc.fps)
      ops.push({ op: "replace", path: "/fps", value: preset.fps });
    if (preset.pacing && preset.pacing !== doc.pacing)
      ops.push({ op: "replace", path: "/pacing", value: preset.pacing });
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
    <div aria-label="Direction" role="group" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div className="facts">
        <span className="fact set">
          <span className="k">aspect</span>
          {doc.aspect}
        </span>
        <span className="fact set">
          <span className="k">fps</span>
          {doc.fps}
        </span>
        <span className="fact set">
          <span className="k">pacing</span>
          {doc.pacing}
        </span>
        {doc.cta ? (
          <span className="fact set" title={doc.cta}>
            <span className="k">cta</span>
            <span className="v">{doc.cta}</span>
          </span>
        ) : (
          <span className="fact empty">
            <span className="k">cta</span>none
          </span>
        )}
        {editable && (
          <>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={mode === "form"}
              onClick={() => setMode(mode === "form" ? "facts" : "form")}
            >
              {mode === "form" ? "Done" : "Edit direction"}
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              aria-pressed={mode === "raw"}
              onClick={() => setMode(mode === "raw" ? "facts" : "raw")}
            >
              Raw .md
            </button>
          </>
        )}
      </div>

      {editable && mode === "form" && (
        <DocForm key={docKey} doc={doc} busy={busy} presets={presets} onEdit={onEdit} onPreset={applyPreset} />
      )}
      {editable && mode === "raw" && <RawView key={docKey} doc={doc} busy={busy} onEdit={onEdit} />}
    </div>
  );
}

interface DocFormProps {
  doc: DirectionDoc;
  busy: boolean;
  presets: StylePreset[];
  onEdit: DirectionFactsProps["onEdit"];
  onPreset: (preset: StylePreset) => void;
}

/** Remounted (via key) whenever the doc changes, so local field state always starts from the persisted artifact. */
function DocForm({ doc, busy, presets, onEdit, onPreset }: DocFormProps) {
  const [title, setTitle] = useState(doc.title);
  const [fps, setFps] = useState(String(doc.fps));
  const [cta, setCta] = useState(doc.cta ?? "");

  function commit(changes: Partial<Record<"title" | "aspect" | "fps" | "pacing" | "cta", unknown>>) {
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
    commit({ title: title.trim() });
  }

  function commitFps() {
    const value = Number(fps);
    if (!Number.isInteger(value) || value < 1 || value > 120) {
      setFps(String(doc.fps));
      return;
    }
    commit({ fps: value });
  }

  return (
    <div className="staged-form">
      <label>
        <span className="lb">Title</span>
        <input
          className="in"
          aria-label="Direction title"
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
        />
      </label>
      <div className="pair">
        <label>
          <span className="lb">Aspect</span>
          <select
            className="in"
            aria-label="Aspect"
            value={doc.aspect}
            disabled={busy}
            onChange={(e) => commit({ aspect: e.target.value })}
          >
            {DIRECTION_ASPECTS.map((aspect) => (
              <option key={aspect} value={aspect}>
                {aspect}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="lb">FPS</span>
          <input
            type="number"
            min={1}
            max={120}
            className="in"
            aria-label="FPS"
            value={fps}
            disabled={busy}
            onChange={(e) => setFps(e.target.value)}
            onBlur={commitFps}
          />
        </label>
        <label>
          <span className="lb">Pacing</span>
          <select
            className="in"
            aria-label="Pacing"
            value={doc.pacing}
            disabled={busy}
            onChange={(e) => commit({ pacing: e.target.value })}
          >
            {DIRECTION_PACINGS.map((pacing) => (
              <option key={pacing} value={pacing}>
                {pacing}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span className="lb">CTA (blank = none)</span>
        <input
          className="in"
          aria-label="CTA"
          value={cta}
          disabled={busy}
          onChange={(e) => setCta(e.target.value)}
          onBlur={() => commit({ cta: cta.trim() === "" ? null : cta.trim() })}
        />
      </label>
      {presets.length > 0 && (
        <div className="facts" role="group" aria-label="Style presets">
          <span className="t-label">Profile presets</span>
          {presets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label={`Apply preset ${preset.title}`}
              aria-disabled={busy}
              title={[preset.aspect, preset.fps && `${preset.fps}fps`, preset.pacing, preset.motion]
                .filter(Boolean)
                .join(" · ")}
              onClick={() => {
                if (busy) return;
                onPreset(preset);
              }}
            >
              {preset.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface RawViewProps {
  doc: DirectionDoc;
  busy: boolean;
  onEdit: DirectionFactsProps["onEdit"];
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p className="t-label">
        Strict-schema markdown — the same document as the facts above, byte-identical round-trip.
        Applied edits are captured as a structured patch.
      </p>
      <textarea
        ref={textareaRef}
        className="raw-md"
        aria-label="Raw direction.md"
        spellCheck={false}
        defaultValue={renderDirectionMd(doc)}
      />
      {error && (
        <p className="t-label" style={{ color: "var(--err)" }} role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="t-label" role="status">
          {info}
        </p>
      )}
      <div>
        <button type="button" className="btn btn-primary btn-sm" aria-disabled={busy} onClick={() => !busy && apply()}>
          Apply raw edit
        </button>
      </div>
    </div>
  );
}
