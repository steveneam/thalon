"use client";

import { useRef, useState } from "react";
import type { Crop } from "@thalon/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mediaUrl } from "@/lib/videos/client";
import {
  clampOrigin,
  displayToSource,
  dragCropAxis,
  panEndpoint,
  panModeOf,
  setCropAxisMode,
} from "@/lib/videos/frame";
import { NumField } from "./num-field";

/**
 * B-ve.5 crop/pan handles: the frame section of the Clip card. The overlay
 * rectangle IS the measuring tool — it reads and writes SOURCE pixels over
 * the real take (the browser's videoWidth/videoHeight is the measurement;
 * CSS percentages only project it). Static axes drag whole; a pan axis
 * drags its start (solid) and end (dashed) windows separately; an
 * expression pan (the b9 sweep class) is shown as data and never dragged —
 * the B-ve.3 knobless-honesty precedent.
 */

interface SourceDims {
  width: number;
  height: number;
}

export function FrameComposer({
  projectId,
  sourceRef,
  playable,
  crop,
  onPatch,
}: {
  projectId: string;
  sourceRef: string;
  playable: boolean;
  crop: Crop;
  onPatch: (crop: Crop) => void;
}) {
  const [dims, setDims] = useState<SourceDims | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    which: "start" | "end";
    startX: number;
    startY: number;
    crop: Crop;
  } | null>(null);

  const xMode = panModeOf(crop.x);
  const yMode = panModeOf(crop.y);
  const hasPanAxis = xMode === "pan" || yMode === "pan";
  const hasExpression = xMode === "expression" || yMode === "expression";

  const windowAt = (which: "start" | "end") => ({
    x: panEndpoint(crop.x, which),
    y: panEndpoint(crop.y, which),
  });

  const beginDrag = (which: "start" | "end", event: React.PointerEvent) => {
    if (!dims || hasExpression) return;
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragRef.current = { which, startX: event.clientX, startY: event.clientY, crop };
  };

  const moveDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage || !dims) return;
    const rect = stage.getBoundingClientRect();
    const { which } = drag;
    const startXValue = panEndpoint(drag.crop.x, which);
    const startYValue = panEndpoint(drag.crop.y, which);
    let next = drag.crop;
    if (startXValue !== null) {
      const sx = startXValue + displayToSource(event.clientX - drag.startX, rect.width, dims.width);
      next = dragCropAxis(next, "x", which, sx, dims.width);
    }
    if (startYValue !== null) {
      const sy =
        startYValue + displayToSource(event.clientY - drag.startY, rect.height, dims.height);
      next = dragCropAxis(next, "y", which, sy, dims.height);
    }
    onPatch(next);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  /** CSS-percentage projection of a window at one endpoint (null when an axis is an expression). */
  const rectStyle = (which: "start" | "end") => {
    if (!dims) return null;
    const { x, y } = windowAt(which);
    if (x === null || y === null) return null;
    return {
      left: `${(x / dims.width) * 100}%`,
      top: `${(y / dims.height) * 100}%`,
      width: `${(crop.width / dims.width) * 100}%`,
      height: `${(crop.height / dims.height) * 100}%`,
    };
  };

  const startStyle = rectStyle("start");
  const endStyle = hasPanAxis ? rectStyle("end") : null;

  const commitAxis = (axis: "x" | "y", which: "start" | "end") => (value: number) => {
    const size = axis === "x" ? crop.width : crop.height;
    const bound = dims ? (axis === "x" ? dims.width : dims.height) : Number.MAX_SAFE_INTEGER;
    onPatch(dragCropAxis(crop, axis, which, clampOrigin(value, size, bound), bound));
  };

  return (
    <div className="flex flex-col gap-2" data-testid="frame-composer">
      <p className="u-eyebrow text-muted-foreground">frame</p>
      {playable ? (
        <div ref={stageRef} className="relative w-full max-w-xl select-none overflow-hidden rounded-lg border border-border bg-muted">
          <video
            preload="metadata"
            muted
            src={mediaUrl(projectId, sourceRef)}
            className="block w-full"
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              if (el.videoWidth > 0) setDims({ width: el.videoWidth, height: el.videoHeight });
            }}
          />
          {startStyle && (
            <div
              role="slider"
              aria-label="Crop window (start)"
              aria-valuenow={windowAt("start").x ?? 0}
              aria-valuetext={`x ${windowAt("start").x} y ${windowAt("start").y}`}
              tabIndex={0}
              onPointerDown={(e) => beginDrag("start", e)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              className={cn(
                "absolute cursor-move border-2 border-primary/90 bg-primary/10",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
              style={startStyle}
            />
          )}
          {endStyle && (
            <div
              role="slider"
              aria-label="Crop window (end)"
              aria-valuenow={windowAt("end").x ?? 0}
              aria-valuetext={`x ${windowAt("end").x} y ${windowAt("end").y}`}
              tabIndex={0}
              onPointerDown={(e) => beginDrag("end", e)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              className="absolute cursor-move border-2 border-dashed border-primary/70 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              style={endStyle}
            />
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Playback is off on this box — the window is editable by numbers only.
        </p>
      )}
      <p className="u-tabular text-xs text-muted-foreground">
        window {crop.width}×{crop.height}
        {dims
          ? ` · of ${dims.width}×${dims.height} (measured)`
          : playable
            ? " · measuring…"
            : ""}
      </p>
      {hasExpression && (
        <p className="break-all font-mono text-xs text-muted-foreground">
          expression pan (edited as data, never dragged):{" "}
          {xMode === "expression" ? (crop.x as { expr: string }).expr : (crop.y as { expr: string }).expr}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <NumField
          label="width"
          value={crop.width}
          min={2}
          step={2}
          className="w-20"
          onCommit={(w) => onPatch({ ...crop, width: Math.max(2, Math.round(w / 2) * 2) })}
        />
        <NumField
          label="height"
          value={crop.height}
          min={2}
          step={2}
          className="w-20"
          onCommit={(h) => onPatch({ ...crop, height: Math.max(2, Math.round(h / 2) * 2) })}
        />
        {xMode !== "expression" && (
          <>
            {xMode === "static" ? (
              <NumField
                label="x"
                value={panEndpoint(crop.x, "start") ?? 0}
                min={0}
                className="w-20"
                onCommit={commitAxis("x", "start")}
              />
            ) : (
              <>
                <NumField
                  label="x from"
                  value={panEndpoint(crop.x, "start") ?? 0}
                  min={0}
                  className="w-20"
                  onCommit={commitAxis("x", "start")}
                />
                <NumField
                  label="x to"
                  value={panEndpoint(crop.x, "end") ?? 0}
                  min={0}
                  className="w-20"
                  onCommit={commitAxis("x", "end")}
                />
              </>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPatch(setCropAxisMode(crop, "x", xMode === "static" ? "pan" : "static"))}
            >
              {xMode === "static" ? "x: static → pan" : "x: pan → static"}
            </Button>
          </>
        )}
        {yMode !== "expression" &&
          (yMode === "static" ? (
            <NumField
              label="y"
              value={panEndpoint(crop.y, "start") ?? 0}
              min={0}
              className="w-20"
              onCommit={commitAxis("y", "start")}
            />
          ) : (
            <>
              <NumField
                label="y from"
                value={panEndpoint(crop.y, "start") ?? 0}
                min={0}
                className="w-20"
                onCommit={commitAxis("y", "start")}
              />
              <NumField
                label="y to"
                value={panEndpoint(crop.y, "end") ?? 0}
                min={0}
                className="w-20"
                onCommit={commitAxis("y", "end")}
              />
            </>
          ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Coordinates are SOURCE pixels — drag the window on the real frame or type measured
        values; pan targets are measured, never estimated.
      </p>
    </div>
  );
}
