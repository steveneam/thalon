"use client";

import { useEffect, useState } from "react";
import { CreateSurface, type CreateFamily } from "@/components/create/create-surface";
import { fetchCreateContext } from "@/lib/intel/client";
import type { CreateContext } from "@/lib/intel/types";

interface CreateContextLoaderProps {
  /** The ?ctx= capture id — resolved through the API route (the store lives in the route layer). */
  contextId: string;
  initialPrompt: string;
  initialKeyword: string;
  initialFamily?: CreateFamily;
}

/**
 * Resolves the intel handoff before rendering Create. A stale or unknown
 * capture id degrades to a plain Create surface — the handoff is a
 * convenience, never a gate.
 */
export function CreateContextLoader({ contextId, ...rest }: CreateContextLoaderProps) {
  const [state, setState] = useState<{ resolved: boolean; context: CreateContext | null }>({
    resolved: false,
    context: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetchCreateContext(contextId)
      .then((context) => {
        if (!cancelled) setState({ resolved: true, context });
      })
      .catch(() => {
        if (!cancelled) setState({ resolved: true, context: null });
      });
    return () => {
      cancelled = true;
    };
  }, [contextId]);

  if (!state.resolved) {
    // The sheet's own resting chrome — the surface's shell, not a bridged
    // one-off (this file left the bridge burn-down map with Create's s74
    // rebuild).
    return (
      <div className="content" style={{ gap: 16 }}>
        <h1 className="t-headline">Create</h1>
        <span className="t-label">Reading the capture you brought…</span>
      </div>
    );
  }
  return <CreateSurface {...rest} context={state.context} />;
}
