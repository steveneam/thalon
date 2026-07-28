"use client";

import "@/components/videos/editor.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VIDEO_DERIVE_ASPECTS, type Edl, type VideoCutAttribution, type VideoDeriveAspect } from "@thalon/contracts";
import { EditorInspector } from "@/components/videos/editor-inspector";
import { EditorTimeline, type Selection } from "@/components/videos/editor-timeline";
import { aspectOf, proposalMarks, takeCaption } from "@/components/videos/editor-model";
import { attributionLine, staleAgainstParent, timecode } from "@/components/videos/videos-model";
import {
  approveCut,
  deriveCut,
  fetchCutDetail,
  fetchProjectDetail,
  fetchRenderJob,
  mediaUrl,
  previewCut,
  proposeDiff,
  rejectProposal,
  saveCut,
  startRender,
  type CaptionRefusal,
  type DiffProposal,
} from "@/lib/videos/client";
import { defaultCutFor, nextVersionFor, splitLane, swapBeatSource, swapCandidatesFor } from "@/lib/videos/editor";
import type { CutDetail, ProjectDetail, RenderJobView } from "@/lib/videos/types";
import { useListKeys } from "@/lib/workspace/keyboard";

type ReadStatus = "loading" | "error" | "missing" | "ready";

/**
 * The sheet's four copilot chips — and WHICH OF THEM THE SURFACE CAN NOW DO
 * ITSELF (slice (e), "wire them or say so").
 *
 * Two of these stopped needing the agent this session. "Swap music" is a local
 * verb over the project's own candidate beds, and "Recut 9:16" is the aspect
 * lens's own derive — both free, both instant, both already on this screen.
 * Sending either through the copilot would spend a metered gateway call to ask
 * an agent to propose something the operator could simply have done, which is
 * the definition of a chip that is decoration.
 *
 * The other two are genuine asks: re-timing a cut to 30s and re-briefing a beat
 * are judgement, not a transform, and they say so.
 */
const CHIPS: { label: string; local: "music" | "9:16" | null }[] = [
  { label: "Tighten to 30s", local: null },
  { label: "Recut 9:16", local: "9:16" },
  { label: "Swap music", local: "music" },
  { label: "Retake a beat", local: null },
];

/**
 * Video editor — STEP 2 of the two-step rebuild: the byte-true port of
 * Videos.dc.html with the real cut behind it. The sheet owns every band,
 * class and copy grammar; this layer only decides what is TRUE to render:
 *
 *  - the COPILOT is the real B-ve.4 propose door: the agent answers with a
 *    diff, the diff lands on the timeline as the sheet's `.prop` marks and
 *    in the proposal row, and NOTHING applies until the operator says so.
 *    Dismiss takes the reason with it — the correction becomes an eval row,
 *    exactly like a rejected take carries its reason;
 *  - the TIMELINE is the EDL: three lanes, magnetic reorder, edge trims,
 *    caption plates at their real fade windows, the music cue with its
 *    measured offset. The sheet's crescendo diamonds are NOT drawn — an
 *    AudioCue records offset, gain and tail easing, and nothing measures
 *    crescendos, so drawing them would be an invented fact;
 *  - the ASPECT LENS switches to an existing derived cut or derives one
 *    (measured seeds, 0 credits, lineage stamped server-side);
 *  - the PRIMARY BUTTON is the next real step for this cut — Save as vN+1
 *    while the working copy is dirty, then Render, then Send cut to
 *    Approve. The sheet draws one primary button and this is the one it
 *    draws, in whichever state the cut is actually in;
 *  - the TAKES strip is the slot-scoped swap: keepers first, rejects
 *    VISIBLE with their reasons — the learning material is part of the
 *    picker.
 *
 * Keepers re-entered as STATE behind the sheet's own chrome (never as extra
 * chrome): the knobs (trim, caption text/plate, music offset/gain/tail) and
 * the B-ve.5/7 reframe live in the inspector a selected block opens;
 * nothing is selected at rest.
 */
export function VideoEditor({ projectId, cutId }: { projectId: string; cutId: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<ReadStatus>("loading");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [cut, setCut] = useState<CutDetail | null>(null);
  const [edl, setEdl] = useState<Edl | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<CaptionRefusal[]>([]);
  const [job, setJob] = useState<RenderJobView | null>(null);
  /*
   * THE WORKING-COPY PREVIEW, and the one thing that makes it honest.
   *
   * `preview` remembers the EDL it was rendered FROM, not just the file. The
   * player only shows it while `preview.edl === edl` by reference — and since
   * every transform in lib/videos/editor.ts returns a NEW object, the next
   * edit of any kind invalidates it automatically. There is no "remember to
   * clear the preview" line to forget in a future verb, which is exactly the
   * class of bug that produced the stale-render problem this verb fixes.
   * Undoing back to the previewed EDL restores that same reference, so the
   * preview correctly becomes valid again.
   */
  const [previewJob, setPreviewJob] = useState<{ job: RenderJobView; edl: Edl; ref: string } | null>(
    null,
  );
  const [preview, setPreview] = useState<{ edl: Edl; ref: string } | null>(null);
  /*
   * The clock is READ ONCE, at load, and pinned — the dossier's own pattern.
   * Relative dates ("11 days ago") re-derived on every render would churn the
   * header for no reason, and a component that reads the wall clock mid-render
   * is the shape of bug that turned main red every evening in s80.
   */
  const [readAt, setReadAt] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ask, setAsk] = useState("");
  const [proposal, setProposal] = useState<DiffProposal | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  // An applied agent proposal rides the next save as its attribution; any
  // MANUAL edit after Apply clears it — the EDL is no longer base + diff and
  // the save door would (rightly) refuse the replay check.
  const [pending, setPending] = useState<VideoCutAttribution | null>(null);
  /*
   * THE SAFETY CORE (s80). `apply()` was the single funnel for every manual
   * edit and it only ever pushed FORWARD — nothing retained the EDL the
   * operator started from, so a pointer-down within 9px of a beat's right edge
   * (which starts a trim) plus one pixel of movement rewrote a duration that
   * could then be restored only by reloading the page, which was never offered
   * and never warned about. Versioning protected the SAVED version; the working
   * copy had nothing.
   *
   * `past`/`future` are the bounded undo spine; `baseEdl` is the EDL as loaded
   * or last saved, which is what Discard returns to. All three are client
   * state over the one working copy — no schema, no new door (pre-plan §1).
   */
  const [past, setPast] = useState<Edl[]>([]);
  const [future, setFuture] = useState<Edl[]>([]);
  const [baseEdl, setBaseEdl] = useState<Edl | null>(null);
  /** Where an intercepted exit was heading — non-null means the guard is open. */
  const [exitTo, setExitTo] = useState<string | null>(null);
  const askRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /** Bounded so a long session cannot grow the heap without limit. */
  const UNDO_LIMIT = 50;

  const load = useCallback(
    () =>
      fetchProjectDetail(projectId)
        .then((project) => {
          if (project === null) {
            setStatus("missing");
            return;
          }
          setDetail(project);
          // Pinned HERE, in the load's own resolution, rather than in the
          // effect body: setting state synchronously in an effect cascades a
          // render (and eslint says so), and reading the clock during the first
          // render would differ between the server pass and the client one.
          setReadAt(Date.now());
          const target = cutId ?? defaultCutFor(project.cuts)?.id ?? null;
          if (target === null) {
            setCut(null);
            setStatus("ready");
            return;
          }
          return fetchCutDetail(projectId, target).then((found) => {
            setCut(found);
            setEdl(found?.edl ?? null);
            // The stored EDL is what Discard returns to; history starts empty.
            setBaseEdl(found?.edl ?? null);
            setPast([]);
            setFuture([]);
            setDirty(false);
            setStatus("ready");
          });
        })
        .catch(() => setStatus("error")),
    [projectId, cutId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Fire-and-poll: a render is minutes of local x264 (0 credits, A17).
  useEffect(() => {
    if (job?.status !== "running") return;
    const timer = setInterval(() => {
      void fetchRenderJob(projectId, job.id).then((next) => {
        if (next === null) return;
        setJob(next);
        if (next.status === "done") {
          setCut((current) =>
            current ? { ...current, status: "rendered", outputRef: next.outputRef } : current,
          );
        }
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [job, projectId]);

  /*
   * The preview's own poll. Deliberately NOT folded into the render poll above:
   * that one flips the cut to `rendered` and adopts the output as the cut's
   * outputRef, which is exactly what a preview must never do — an unsaved EDL
   * has no business in the version history.
   */
  useEffect(() => {
    if (previewJob === null || previewJob.job.status !== "running") return;
    const timer = setInterval(() => {
      void fetchRenderJob(projectId, previewJob.job.id).then((next) => {
        if (next === null) return;
        setPreviewJob((current) => (current ? { ...current, job: next } : current));
        if (next.status === "done") setPreview({ edl: previewJob.edl, ref: previewJob.ref });
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [previewJob, projectId]);

  /**
   * The ONE manual edit funnel — one dirty bit, one working copy, and now one
   * history. Every edit pushes the PREVIOUS EDL onto `past` and clears `future`
   * (a new edit after an undo forks: the redone-away branch is gone, which is
   * the standard and the only one that cannot surprise).
   */
  const apply = useCallback((fn: (edl: Edl) => Edl) => {
    setEdl((current) => {
      if (current === null) return current;
      setPast((stack) => [...stack, current].slice(-UNDO_LIMIT));
      setFuture([]);
      return fn(current);
    });
    setDirty(true);
    setPending(null);
  }, []);

  /** Step back one edit. Dirty stays true — undoing to base is not the same as saving. */
  const undo = useCallback(() => {
    setPast((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setEdl((current) => {
        if (current !== null) setFuture((f) => [current, ...f].slice(0, UNDO_LIMIT));
        return previous;
      });
      setDirty(true);
      setPending(null);
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((stack) => {
      if (stack.length === 0) return stack;
      const [next, ...rest] = stack;
      setEdl((current) => {
        if (current !== null) setPast((p) => [...p, current].slice(-UNDO_LIMIT));
        return next;
      });
      setDirty(true);
      setPending(null);
      return rest;
    });
  }, []);

  /** Back to the stored version — the whole working copy, in one step. */
  const discard = useCallback(() => {
    if (baseEdl === null) return;
    setEdl(baseEdl);
    setPast([]);
    setFuture([]);
    setDirty(false);
    setPending(null);
    setSelection(null);
  }, [baseEdl]);

  /*
   * ⌘/Ctrl+Z and ⇧⌘/Ctrl+Z. This CANNOT ride `useListKeys`: that grammar
   * deliberately returns early on ctrlKey||metaKey (lib/workspace/keyboard.ts),
   * because j/k list navigation must not eat browser shortcuts. So undo needs
   * its own modifier-aware listener, which is exactly why the audit found
   * ⌘Z unbound across the whole surface.
   */
  useEffect(() => {
    if (status !== "ready") return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea")) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, undo, redo]);

  /*
   * THE UNSAVED-WORK GUARD — every exit, not just the ones in this file.
   *
   * The audit named three plain <Link>s ("← project", "Cut history →", "All
   * takes →") that discard a dirty working copy silently, but they are not the
   * whole set: the workspace rail is a dozen more, and it is rendered by the
   * shell, outside this component. Rather than guard three links by hand and
   * leave the rail unguarded — the kind of partial fix that reads as done — one
   * CAPTURE-phase listener catches any in-app anchor click while dirty and asks
   * first. `capture: true` so it runs before Next's own router handler.
   *
   * NOT covered, stated rather than implied: the browser BACK button. A history
   * pop cannot be cancelled without pushing a decoy entry, which corrupts the
   * back stack for every other surface. beforeunload covers reload and close;
   * back remains a way to lose a working copy, and it is on the list.
   */
  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      // Staying on this cut is not an exit.
      const here = `${window.location.pathname}${window.location.search}`;
      if (href === here) return;
      event.preventDefault();
      event.stopPropagation();
      setExitTo(href);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, [dirty]);

  /** Reload and tab-close — the browser's own guard, armed only while dirty. */
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const beats = useMemo(() => (edl === null ? [] : splitLane(edl).beats), [edl]);
  const marks = useMemo(
    () => proposalMarks(proposal?.diff ?? null),
    [proposal],
  );

  // j/k walk the beat lane — the one list keyboard grammar, on the surface's
  // own list (the beats rail is that list here).
  const move = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (beats.length === 0) return;
    if ((event.target as HTMLElement | null)?.closest("input, textarea")) return;
    event.preventDefault();
    const current = selection?.kind === "beat" ? selection.index : -1;
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), beats.length - 1);
    setSelection({ kind: "beat", index: next });
  };
  useListKeys({ enabled: status === "ready" && edl !== null, bindings: { j: move(1), k: move(-1) } });

  function run(work: () => Promise<string | null>) {
    setBusy(true);
    setNotice(null);
    setRefusals([]);
    work()
      .then((message) => setNotice(message))
      .catch((err: unknown) => setNotice(err instanceof Error ? err.message : "that door refused"))
      .finally(() => setBusy(false));
  }

  function onSave() {
    if (cut === null || edl === null) return;
    run(async () => {
      const { cut: saved } = await saveCut(projectId, {
        name: cut.name,
        edl,
        ...(pending ? { attribution: pending } : {}),
        // A derived cut's new versions carry the parent pin forward.
        ...(cut.lineage
          ? { meta: { lineage: { parentCutId: cut.lineage.parentCutId, aspect: cut.lineage.aspect } } }
          : {}),
      });
      setCut(saved);
      setEdl(saved.edl);
      // The saved version becomes the new base — Discard now means "back to
      // v{saved.version}", and the pre-save history is no longer reachable.
      setBaseEdl(saved.edl);
      setPast([]);
      setFuture([]);
      setDirty(false);
      setJob(null);
      setPending(null);
      router.replace(`/app/videos/${projectId}/edit?cut=${saved.id}`, { scroll: false });
      void fetchProjectDetail(projectId).then((p) => p && setDetail(p));
      return `Saved as ${saved.name} v${saved.version} — the previous version is untouched.`;
    });
  }

  function onRender() {
    if (cut === null) return;
    run(async () => {
      const { job: fired } = await startRender(projectId, cut.id);
      setJob(fired);
      return "Rendering locally (0 credits) — minutes of x264; this page polls until it lands.";
    });
  }

  /**
   * PREVIEW THE WORKING COPY. Fires the same local ffmpeg the render door
   * uses, against the unsaved EDL, writing to an overwritable preview file
   * that never touches the version history. Compute, not credits.
   */
  function onPreview() {
    if (cut === null || edl === null) return;
    const previewed = edl;
    run(async () => {
      const { job: fired, outputRef } = await previewCut(projectId, cut.id, previewed);
      setPreviewJob({ job: fired, edl: previewed, ref: outputRef });
      return "Previewing your unsaved edit locally (0 credits) — nothing is saved by this.";
    });
  }

  function onApprove() {
    if (cut === null) return;
    run(async () => {
      const outcome = await approveCut(projectId, cut.id);
      if (outcome.ok) {
        setCut(outcome.cut);
        return `${outcome.cut.name} v${outcome.cut.version} passed the gate.`;
      }
      setRefusals(outcome.failures);
      return outcome.error;
    });
  }

  function onAspect(aspect: VideoDeriveAspect) {
    if (cut === null || detail === null) return;
    const existing = detail.cuts.find((c) => c.lineage?.aspect === aspect);
    if (existing) {
      router.push(`/app/videos/${projectId}/edit?cut=${existing.id}`);
      return;
    }
    run(async () => {
      const { cut: derived } = await deriveCut(projectId, cut.id, aspect);
      router.push(`/app/videos/${projectId}/edit?cut=${derived.id}`);
      return `Derived ${derived.name} for ${aspect} — measured seeds, 0 credits.`;
    });
  }

  function onPropose() {
    if (cut === null) return;
    setProposal(null);
    setDiffOpen(false);
    setRejectReason(null);
    run(async () => {
      setProposal(await proposeDiff(projectId, cut.id, ask));
      return null;
    });
  }

  function onDismissProposal() {
    if (cut === null || proposal === null || rejectReason === null || rejectReason.trim() === "") return;
    run(async () => {
      await rejectProposal(projectId, cut.id, {
        diff: proposal.diff,
        reason: rejectReason.trim(),
        ...(ask.trim() ? { ask: ask.trim() } : {}),
      });
      setProposal(null);
      setRejectReason(null);
      return "Dismissed — the correction is now an eval row.";
    });
  }

  if (status !== "ready" || detail === null) {
    return (
      <div className="content editor-surface" style={{ gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link className="card-link" href="/app/videos">
            ← Videos
          </Link>
          <h1 className="t-headline">Editor</h1>
        </div>
        <div className="card">
          <div className="row" role={status === "error" ? "alert" : undefined}>
            <span className="t-label" style={{ flex: 1 }}>
              {status === "loading"
                ? "Reading this cut…"
                : status === "missing"
                  ? "This project doesn’t exist, or belongs to another tenant."
                  : "Couldn’t read the editor — a read failure, not an empty cut."}
            </span>
            {status === "error" && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setStatus("loading");
                  void load();
                }}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (cut === null || edl === null) {
    return (
      <div className="content editor-surface" style={{ gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link className="card-link" href={`/app/videos/${projectId}`}>
            ← {detail.name}
          </Link>
          <h1 className="t-headline">Editor</h1>
        </div>
        <div className="card">
          <div className="row">
            <span className="t-label">
              No cut to edit yet — a cut’s EDL is what the editor works on. The one-prompt run
              writes the first one; the import script registers takes, not cuts.
            </span>
          </div>
        </div>
      </div>
    );
  }

  const currentAspect = aspectOf(edl.output.width, edl.output.height);
  const nextVersion = nextVersionFor(detail.cuts, cut.name);
  /*
   * A preview is only shown while it is a preview OF WHAT IS ON SCREEN.
   * Reference equality against the working copy: any edit produces a new EDL
   * object and this goes false on its own.
   */
  const previewFresh = preview !== null && preview.edl === edl;
  const shownRef = previewFresh ? preview.ref : cut.outputRef;
  /**
   * The way back to the 16:9 master. A derived cut pins its parent in
   * `lineage.parentCutId`; a cut with no lineage was never derived from
   * anything, and saying so is a better answer than a control that looks live
   * and does nothing.
   */
  const masterDoor: { refusal: string | null; go: () => void } = (() => {
    const parentId = cut.lineage?.parentCutId ?? null;
    if (currentAspect === "16:9") return { refusal: "This IS the 16:9 master.", go: () => {} };
    if (dirty) {
      return {
        refusal: "Save first — leaving this cut with unsaved edits would throw them away.",
        go: () => {},
      };
    }
    if (parentId === null) {
      return {
        refusal: `This ${currentAspect} cut has no 16:9 master on record — it was not derived from one.`,
        go: () => {},
      };
    }
    return {
      refusal: null,
      go: () => router.push(`/app/videos/${projectId}/edit?cut=${parentId}`),
    };
  })();
  const selectedClip = selection?.kind === "beat" ? beats[selection.index] : undefined;
  const candidates =
    selectedClip === undefined
      ? []
      : swapCandidatesFor(detail.takes, selectedClip.source.ref).filter(
          (take) => take.ref !== selectedClip.source.ref,
        );
  const keeperRefs = new Set(
    detail.takes.filter((t) => t.disposition === "keeper").map((t) => t.ref),
  );
  const rejectRefs = new Set(
    detail.takes.filter((t) => t.disposition === "reject").map((t) => t.ref),
  );

  /** The sheet draws ONE primary button; this is it, in the state the cut is actually in. */
  const primary = dirty
    ? { label: `Save as v${nextVersion}`, onClick: onSave, disabled: false }
    : cut.status === "draft"
      ? {
          label: job?.status === "running" ? "Rendering…" : "Render",
          onClick: onRender,
          disabled: job?.status === "running",
        }
      : cut.status === "rendered"
        ? { label: "Send cut to Approve", onClick: onApprove, disabled: false }
        : { label: "Approved", onClick: () => {}, disabled: true };

  return (
    <div className="content editor-surface" style={{ gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link className="card-link" href={`/app/videos/${projectId}`}>
          ← {detail.name}
        </Link>
        <h1 className="t-headline">
          {cut.name} v{cut.version}
        </h1>
        <span className="pill pill-idle">
          {dirty ? `unsaved · ${edl.output.duration}s` : `${cut.status} · ${edl.output.duration}s`}
        </span>
        <span className="pill pill-ok">
          {detail.takes.length} take{detail.takes.length === 1 ? "" : "s"} on record
        </span>
        {pending?.authoredBy === "agent" && (
          <span className="pill pill-warn">agent proposal applied</span>
        )}
        <div style={{ flex: 1 }} />
        {/*
          THE ASPECT LENS — both of the surface's remaining dead doors lived here.

          (1) 16:9 was a <span aria-hidden> between two real buttons: it took the
          hover, ate the click and was invisible to assistive tech, so a derived
          cut had no way back to the master it came from. It is a button now,
          and it routes to `lineage.parentCutId` — the master IS the parent.

          (2) Every refusal here lived only in `title`. A disabled control fires
          no tooltip and screen readers skip it, so "why can't I press this?"
          had no answer by any route. So refusals no longer DISABLE: the control
          stays focusable, says `aria-disabled` so AT announces the state, and
          answers with its reason in the notice band when pressed. Refusing is
          fine; refusing silently is not.
        */}
        <div className="seg" role="group" aria-label="Aspect">
          <button
            type="button"
            className={currentAspect === "16:9" ? "seg-opt on" : "seg-opt"}
            aria-pressed={currentAspect === "16:9"}
            aria-disabled={masterDoor.refusal !== null || undefined}
            disabled={busy}
            title={masterDoor.refusal ?? "Back to the 16:9 master this cut was derived from"}
            onClick={() =>
              masterDoor.refusal !== null ? setNotice(masterDoor.refusal) : masterDoor.go()
            }
          >
            16:9
          </button>
          {VIDEO_DERIVE_ASPECTS.map((aspect) => {
            const refusal =
              currentAspect === aspect
                ? `You are already editing the ${aspect} cut.`
                : dirty
                  ? "Save first — a derive reads the STORED EDL, so it cannot see your unsaved edits."
                  : null;
            return (
              <button
                key={aspect}
                type="button"
                className={currentAspect === aspect ? "seg-opt on" : "seg-opt"}
                aria-pressed={currentAspect === aspect}
                aria-disabled={refusal !== null || undefined}
                disabled={busy}
                title={
                  refusal ?? `Switch to the ${aspect} cut, or derive one (measured seeds, 0 credits)`
                }
                onClick={() => (refusal !== null ? setNotice(refusal) : onAspect(aspect))}
              >
                {aspect}
              </button>
            );
          })}
        </div>
        {/*
          Undo is bound to ⌘/Ctrl+Z, but a keyboard-only undo is an invisible
          one — the operator who most needs it is the one who does not know it
          exists. These render only while there is something to undo, so the
          resting surface is unchanged.
        */}
        {past.length > 0 && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={undo}
            title={`Undo the last edit (${past.length} step${past.length === 1 ? "" : "s"} back) — ⌘Z`}
          >
            Undo
          </button>
        )}
        {future.length > 0 && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={redo}
            title={`Redo (${future.length} forward) — ⇧⌘Z`}
          >
            Redo
          </button>
        )}
        {dirty && baseEdl !== null && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={discard}
            title={`Throw away every unsaved edit and return to the stored v${cut.version}`}
          >
            Discard changes → v{cut.version}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => askRef.current?.focus()}
        >
          Propose edits
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || primary.disabled}
          onClick={primary.onClick}
        >
          {busy ? "Working…" : primary.label}
        </button>
      </div>

      <div className="copilot">
        {/*
          THE VOW IS NOT A PLACEHOLDER. "the agent answers with a proposal on
          the timeline, never a silent change" is the surface's provenance
          promise (ui-overhaul-plan §5), and as placeholder text it vanished the
          moment the operator typed — the one moment it is load-bearing — and
          was truncated by the input's width even before that. So the box holds
          both: the EXAMPLE stays a placeholder (a prompt, fairly ephemeral) and
          the PROMISE is visible text that nothing dismisses.
        */}
        <div className="cop-box">
          <input
            ref={askRef}
            className="cop-ask"
            value={ask}
            aria-label="Direct the edit"
            placeholder="Direct the edit — “land the tail easing on the close”"
            onChange={(event) => setAsk(event.target.value)}
          />
          <span className="cop-vow">
            The agent answers with a proposal on the timeline — <em>never a silent change</em>.
          </span>
        </div>
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="chipbtn"
            title={
              chip.local === "music"
                ? "Opens the music lane's bed picker — local, instant, 0 credits"
                : chip.local === "9:16"
                  ? "Uses the aspect lens's own derive — measured seeds, 0 credits"
                  : "Fills the ask — Propose then spends a metered agent call"
            }
            onClick={() => {
              if (chip.local === "music") {
                setSelection({ kind: "music" });
                return;
              }
              if (chip.local === "9:16") {
                onAspect("9:16");
                return;
              }
              /*
                APPEND, never overwrite. These chips sit immediately right of
                the box the operator has just typed into and read as additive
                suggestions; `setAsk(chip)` threw a composed directive away with
                no undo and no re-entry path.
              */
              setAsk((current) => (current.trim() === "" ? chip.label : `${current.trim()}; ${chip.label}`));
              askRef.current?.focus();
            }}
          >
            {chip.label}
          </button>
        ))}
        {/*
          The second half of the title-only refusal (the aspect lens was the
          first): Propose went disabled while dirty with its reason reachable
          only by hovering a control that, being disabled, fires no tooltip.
          Same remedy — it stays focusable, announces `aria-disabled`, and says
          why in the notice band when pressed.
        */}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          aria-disabled={dirty || undefined}
          title={
            dirty
              ? "Save your manual edits first — the agent proposes against the stored cut"
              : "The agent answers with a proposal on the timeline — this spends a metered call"
          }
          onClick={() =>
            dirty
              ? setNotice(
                  "Save your manual edits first — the agent proposes against the STORED cut, so it cannot see them.",
                )
              : onPropose()
          }
        >
          {busy ? "Proposing…" : "Propose"}
        </button>
      </div>

      {/*
        THE EXIT GUARD. Save / Discard / Stay — the three honest answers. It
        names the destination and the version, because "you have unsaved
        changes" without saying unsaved SINCE WHAT is a question the operator
        cannot answer.
      */}
      {exitTo !== null && (
        <div className="card notice-band refused" role="alertdialog" aria-label="Unsaved changes">
          <span className="t-label">
            You have unsaved edits to {cut.name} v{cut.version}. Leaving now throws them away.
          </span>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => {
                const to = exitTo;
                setExitTo(null);
                // Save first, then leave — onSave clears `dirty`, so the guard
                // will not re-arm and swallow this navigation a second time.
                run(async () => {
                  const { cut: saved } = await saveCut(projectId, {
                    name: cut.name,
                    edl,
                    ...(pending ? { attribution: pending } : {}),
                    ...(cut.lineage
                      ? { meta: { lineage: { parentCutId: cut.lineage.parentCutId, aspect: cut.lineage.aspect } } }
                      : {}),
                  });
                  setDirty(false);
                  setBaseEdl(saved.edl);
                  router.push(to);
                  return `Saved as ${saved.name} v${saved.version} — leaving.`;
                });
              }}
            >
              Save, then leave
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => {
                const to = exitTo;
                discard();
                setExitTo(null);
                router.push(to);
              }}
            >
              Discard and leave
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExitTo(null)}>
              Stay here
            </button>
          </div>
        </div>
      )}

      {(notice !== null || refusals.length > 0) && (
        <div className={refusals.length > 0 ? "card notice-band refused" : "card notice-band"} role="status">
          {notice !== null && <span className="t-label">{notice}</span>}
          {refusals.map((refusal) => (
            <span key={refusal.line} className="t-label">
              line {refusal.line} “{refusal.text}” — {refusal.matches.join("; ")}
            </span>
          ))}
          {job?.status === "error" && <span className="t-label">Render failed: {job.error}</span>}
        </div>
      )}

      <div className="ed-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div className="player">
            {playing && shownRef !== null ? (
              <video
                ref={videoRef}
                className="player-video"
                controls
                autoPlay
                preload="metadata"
                src={mediaUrl(projectId, shownRef)}
                /*
                  PLAYBACK DRIVES THE PLAYHEAD. The seek direction was already
                  wired — clicking the ruler moves the marker AND the video —
                  but the return path was not, so watching the cut left the
                  timeline dead: nothing said where you were, and there was no
                  moment to stop at. The marker and the scrub bar both read
                  this one fraction.
                */
                onTimeUpdate={(event) => {
                  const el = event.currentTarget;
                  if (!Number.isFinite(el.duration) || el.duration <= 0) return;
                  setPlayhead(Math.min(1, el.currentTime / el.duration));
                }}
              />
            ) : (
              <>
                <div className="player-rest">
                  <button
                    type="button"
                    className="play-btn"
                    aria-label={
                      previewFresh
                        ? "Play the preview of your unsaved edits"
                        : `Play ${cut.name} v${cut.version}`
                    }
                    disabled={!detail.playable || shownRef === null}
                    onClick={() => setPlaying(true)}
                  >
                    <div className="play-tri" />
                  </button>
                  {(shownRef === null || !detail.playable) && (
                    <span className="t-data">
                      {shownRef === null
                        ? `no render yet for v${cut.version} — the primary button renders it, locally, 0 credits`
                        : "no media root configured on this box — refs on record, playback off"}
                    </span>
                  )}
                  {/*
                    THE HONEST PLAYER, now with the verb it was missing. Saying
                    "your edits are not in this" was the truth and half an
                    answer; the other half is being able to SEE them. Three
                    states, each named rather than implied: the stored render,
                    the stored render WHILE dirty, and a preview of the exact
                    working copy on screen.
                  */}
                  {previewFresh && (
                    <span className="t-data">
                      showing a preview of your unsaved edits — nothing is saved until you save
                    </span>
                  )}
                  {dirty && !previewFresh && cut.outputRef !== null && (
                    <span className="t-data">
                      showing the render of v{cut.version} — your unsaved edits are not in it
                    </span>
                  )}
                  {dirty && !previewFresh && detail.playable && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy || previewJob?.job.status === "running"}
                      onClick={onPreview}
                    >
                      {previewJob?.job.status === "running"
                        ? "Rendering preview…"
                        : "Preview this edit — local, 0 credits"}
                    </button>
                  )}
                  {previewJob?.job.status === "error" && (
                    <span className="t-data">Preview failed: {previewJob.job.error}</span>
                  )}
                </div>
                <div className="scrub">
                  <span className="t-data" style={{ color: "var(--n-1000)" }}>
                    {timecode((playhead ?? 0) * edl.output.duration)}
                  </span>
                  <div className="bar-trough" style={{ flex: 1, height: 5 }}>
                    <div
                      className="bar-fill"
                      style={{ width: `${(playhead ?? 0) * 100}%`, background: "var(--act)" }}
                    />
                  </div>
                  <span className="t-data">{timecode(edl.output.duration)}</span>
                </div>
              </>
            )}
          </div>

          <div className="card">
            {proposal !== null && (
              <div className="prop-row">
                <span className="pill pill-warn">proposal</span>
                <span style={{ flex: 1 }}>
                  {proposal.diff.summary} · nothing applies until you say so
                </span>
                <button
                  type="button"
                  className="card-link as-text-btn"
                  aria-expanded={diffOpen}
                  onClick={() => setDiffOpen((open) => !open)}
                >
                  {diffOpen ? "Hide diff ←" : "Review diff →"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    // Deliberately NOT the manual funnel: Apply carries its
                    // attribution, and the save door replay-verifies it.
                    setEdl(proposal.preview);
                    setDirty(true);
                    setPending(proposal.attribution);
                    setProposal(null);
                    setNotice("Applied to the working copy — Save records it as agent-authored.");
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => setRejectReason(rejectReason === null ? "" : null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {proposal !== null && diffOpen && (
              <div className="diff-panel">
                {proposal.diff.ops.map((op, i) => (
                  <div key={i} className="diff-op">
                    <span className="pill pill-idle">{op.op}</span>
                    <span style={{ flex: 1 }}>{op.why}</span>
                  </div>
                ))}
                <span className="t-data">
                  {proposal.attribution.proposal?.model ?? "model unrecorded"} ·{" "}
                  {proposal.tokens.in}/{proposal.tokens.out} tokens
                </span>
              </div>
            )}

            {proposal !== null && rejectReason !== null && (
              <div className="diff-panel">
                <label className="numfield" style={{ flex: 1 }}>
                  why this proposal is wrong (required — it becomes the eval row)
                  <input
                    value={rejectReason}
                    autoFocus
                    onChange={(event) => setRejectReason(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy || rejectReason.trim() === ""}
                  onClick={onDismissProposal}
                >
                  Record the correction
                </button>
              </div>
            )}

            <EditorTimeline
              edl={edl}
              selection={selection}
              onSelect={setSelection}
              onEdl={apply}
              playhead={playhead}
              onPlayhead={(fraction) => {
                setPlayhead(fraction);
                const video = videoRef.current;
                if (video && Number.isFinite(video.duration)) {
                  video.currentTime = Math.min(fraction * video.duration, video.duration);
                }
              }}
              propBeats={marks.beats}
              propCaptions={marks.captions}
              propMusic={marks.music}
            />

            {selection !== null && (
              <EditorInspector
                projectId={projectId}
                edl={edl}
                takes={detail.takes}
                selection={selection}
                playable={detail.playable}
                onEdl={apply}
                onSelect={setSelection}
                onClose={() => setSelection(null)}
              />
            )}

            {/*
              VISIBLE PROVENANCE (ui-overhaul-plan §5) belongs on the surface
              where you act on it. `cut.attribution` was fetched and in hand all
              along, and the only author signal the editor drew was an
              in-session pill for a proposal applied in THIS sitting — so
              re-opening an agent-authored v7 showed an unmarked version: AI
              authorship unstated on the one screen where it gets edited.

              It lands HERE rather than in the header, which is where the audit
              suggested, because the header is already over-subscribed: adding a
              line to it wrapped `.t-headline` onto three lines and pushed every
              band below down 85px, measured. This band is the surface's own
              versioning sentence with the Cut-history door already in it, so
              the fact sits beside the promise it belongs to and costs no
              geometry. A derived cut also states its parent and, when the
              parent has moved, that it has fallen behind — `staleAgainstParent`
              is deliberately computed and deliberately never auto-synced, so
              the surface has to SAY it.
            */}
            <div className="tl-foot">
              {/*
                Shortened when the provenance facts moved in beside it: the tail
                ("cuts are versioned, so an edit never overwrites vN") asserted
                in prose exactly what the version link to its right now states
                as a fact with a door behind it. Keeping both crushed three
                facts into three wrapped columns.
              */}
              <span className="t-label">
                Every edit is a recorded EDL change — the agent proposes, you approve.
              </span>
              <div style={{ flex: 1 }} />
              {staleAgainstParent(cut) && (
                <span className="pill pill-warn">
                  parent now v{cut.lineage?.parentLatestVersion} · no auto-sync
                </span>
              )}
              {cut.lineage !== null && (
                <Link
                  className="card-link"
                  href={`/app/videos/${projectId}/edit?cut=${cut.lineage.parentCutId}`}
                >
                  derived from {cut.lineage.parentName ?? "its parent"}
                  {cut.lineage.parentVersion !== null ? ` v${cut.lineage.parentVersion}` : ""} →
                </Link>
              )}
              <Link
                className="card-link"
                href={`/app/videos/${projectId}`}
                title="Every version and what changed it"
              >
                v{cut.version} · {attributionLine(cut, readAt)} →
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ padding: "9px 16px" }}>
              <span className="t-title">
                {selectedClip === undefined ? "Takes" : `Takes — ${selectedClip.name}`}
              </span>
              <span className="t-label">
                {selectedClip === undefined
                  ? "pick a beat on the timeline to see what auditions for it"
                  : candidates.length === 0
                    ? "no other take auditions for this beat’s slot"
                    : `${candidates.length} other take${candidates.length === 1 ? "" : "s"} · every reject carries its reason`}
              </span>
              <div style={{ flex: 1 }} />
              <Link className="card-link" href={`/app/videos/${projectId}`}>
                All takes →
              </Link>
            </div>
            <div className="strip">
              {selectedClip === undefined ? (
                <span className="t-label">Nothing selected.</span>
              ) : (
                <>
                  <div className="take on">
                    <div className="thumb-md">
                      <span>in the cut</span>
                    </div>
                    <span className="take-cap">
                      {clipTakeCaption(selectedClip.source.ref, keeperRefs, rejectRefs)}
                    </span>
                  </div>
                  {candidates.map((take) => (
                    <button
                      key={take.id}
                      type="button"
                      className="take"
                      /*
                        The verb and the file BOTH belong in the accessible
                        name. "swap this beat to <ref>" lived only in a title,
                        where AT skips it, and the tile itself named neither the
                        take nor what pressing it would do.
                      */
                      aria-label={`Swap this beat to take ${takeName(take.ref)} — ${takeCaption(take)}`}
                      title={`swap this beat to ${take.ref}`}
                      onClick={() =>
                        apply((current) =>
                          swapBeatSource(current, selection?.kind === "beat" ? selection.index : 0, take.ref),
                        )
                      }
                    >
                      <div className="thumb-md">
                        <span>{take.disposition}</span>
                      </div>
                      <span className="take-cap">{takeName(take.ref)}</span>
                      <span className="take-cap">{takeCaption(take)}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <span className="t-title">Beats</span>
            <span className="t-label">
              {beats.length} · {edl.output.duration}s planned
            </span>
          </div>
          <div className="beats-scroll">
            {beats.map((clip, i) => {
              const keeper = keeperRefs.has(clip.source.ref);
              const reject = rejectRefs.has(clip.source.ref);
              return (
                <button
                  key={`${clip.name}-${i}`}
                  type="button"
                  className={
                    selection?.kind === "beat" && selection.index === i ? "beat-row on" : "beat-row"
                  }
                  aria-pressed={selection?.kind === "beat" && selection.index === i}
                  onClick={() => setSelection({ kind: "beat", index: i })}
                >
                  <div className="beat-thumb" />
                  <span style={{ flex: 1, minWidth: 0 }} className="beat-name">
                    {String(i + 1).padStart(2, "0")} · {clip.name}
                  </span>
                  <span className="t-data">{clip.duration}s</span>
                  <span
                    style={{ color: keeper ? "var(--ok)" : reject ? "var(--warn)" : "var(--n-700)" }}
                    title={
                      keeper
                        ? "this beat rides a keeper take"
                        : reject
                          ? "this beat rides a REJECTED take — its reason is in the takes strip"
                          : "this source has no take row (a cut layer or an unregistered file)"
                    }
                  >
                    {keeper ? "✓" : reject ? "!" : "·"}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--n-400)" }}>
            <span className="t-label">
              Every take’s reason is on record · a beat marked ! rides a reject, and the strip says
              why
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A take's FILE NAME — visible in the tile so candidates can be told apart at
 * all, and so it joins the accessible name rather than hiding in a `title` no
 * screen reader reads. The extension stays: these tiles are how an operator
 * identifies one asset among eight near-identical siblings, and half a filename
 * is a worse answer than the whole one.
 */
function takeName(ref: string): string {
  return ref.split("/").pop() ?? ref;
}

/** What the beat's CURRENT source is, in the takes strip's own caption slot. */
function clipTakeCaption(
  ref: string,
  keepers: ReadonlySet<string>,
  rejects: ReadonlySet<string>,
): string {
  if (keepers.has(ref)) return "keeper";
  if (rejects.has(ref)) return "a rejected take — swap it below";
  return "no take row for this source";
}
