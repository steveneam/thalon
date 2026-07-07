"use client";

import { useEffect, useRef } from "react";
import type { Feature } from "@/lib/landing/copy";

/**
 * Real feature demos behind the same `FeatureLoop` seam the CSS placeholders
 * shipped under (docs/FRONTEND.md §2) — the B6.3-deferred swap, landed at the
 * wave-3.5 train with composition-v2's narrated renders. The clips are
 * rendered BY Thalon (deterministic Hyperframes compositions + Kokoro
 * narration), web-encoded to ~300–400KB each (crf30 + light denoise — the
 * archive-quality film grain is h264-hostile; originals live outside the
 * repo in `.context/renders/`).
 *
 * Cards autoplay muted (the narration is reachable in the popout via
 * `controls`); `prefers-reduced-motion` pauses autoplay on the poster frame —
 * the same bar every CSS animation on the landing holds.
 */

const DEMO_LABELS: Record<Feature["key"], string> = {
  intel: "Trend intel demo: ranked cards with readable reasons",
  create: "Create demo: one prompt to a judged, rendered video",
  everywhere: "Everywhere demo: one topic fanned out per platform",
};

export function FeatureLoop({ feature, controls = false }: { feature: Feature["key"]; controls?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof window.matchMedia !== "function") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (reduced.matches) video.pause();
      else void video.play().catch(() => undefined);
    };
    apply();
    reduced.addEventListener("change", apply);
    return () => reduced.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={videoRef}
      src={`/demos/${feature}.mp4`}
      className="h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      controls={controls}
      aria-label={DEMO_LABELS[feature]}
    />
  );
}
