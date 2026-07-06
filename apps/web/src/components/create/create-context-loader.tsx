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
    return <p className="p-4 text-sm text-muted-foreground lg:p-6">Loading intel context…</p>;
  }
  return <CreateSurface {...rest} context={state.context} />;
}
