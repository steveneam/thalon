import type { VideoCutStatus, VideoTakeDisposition, VideoTakeKind } from "@thalon/contracts";

/**
 * B-ve.2 wire shapes: the read-only project surface over the frozen B-ve.1
 * contract. Dates travel as ISO strings (the FeedRun convention); the EDL
 * never travels whole — the browse surface reads its SUMMARY, the full EDL
 * stays a B-ve.3 (editor) concern.
 */

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  keepers: number;
  rejects: number;
  cuts: number;
  createdAt: string;
}

export interface TakeView {
  id: string;
  /** Beat slot ("beat-01"); music candidates carry none. */
  slot: string | null;
  kind: VideoTakeKind;
  disposition: VideoTakeDisposition;
  /** Project-relative asset ref — the take's identity. */
  ref: string;
  /** The learning material: why a reject was rejected. */
  reason: string | null;
  /** B7.1 provenance manifest (model, prompt, credits, mint date) — open shape. */
  provenance: Record<string, unknown>;
  createdAt: string;
}

/** What the browse surface needs to KNOW about an EDL without carrying it. */
export interface EdlSummary {
  beats: number;
  captionLines: number;
  /** silent = no music lane · copy = stream-copied audio · encode = mixed. */
  audio: "silent" | "copy" | "encode";
  width: number;
  height: number;
  fps: number;
  duration: number;
}

export interface CutView {
  id: string;
  name: string;
  version: number;
  status: VideoCutStatus;
  /** Project-relative ref of the rendered output (recordRender). */
  outputRef: string | null;
  edl: EdlSummary;
  createdAt: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  /** meta.mediaRoot configured on this box → the media route will serve refs. */
  playable: boolean;
  takes: TakeView[];
  cuts: CutView[];
}
