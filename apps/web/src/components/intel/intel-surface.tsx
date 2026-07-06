"use client";

import { useState } from "react";
import { SearchTab } from "@/components/intel/search-tab";
import { TrendsTab } from "@/components/intel/trends-tab";
import { cn } from "@/lib/utils";

export type IntelTab = "trends" | "search";

/**
 * Intel = one feature, two tabs (ADR 0006: attention + demand, zero new UI
 * real estate beyond tabs). The active tab mirrors into ?tab= so links can
 * deep-link (?tab=search) without a useSearchParams/Suspense dance — the
 * server page reads the param once and hands over.
 */
export function IntelSurface({ initialTab }: { initialTab: IntelTab }) {
  const [tab, setTab] = useState<IntelTab>(initialTab);

  function select(next: IntelTab) {
    setTab(next);
    window.history.replaceState(null, "", next === "trends" ? "/app/intel" : `/app/intel?tab=${next}`);
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div role="tablist" aria-label="Intel tabs" className="flex gap-1 border-b border-border">
        {(
          [
            { id: "trends", label: "Trends", hint: "rising on social" },
            { id: "search", label: "Search", hint: "rising on search" },
          ] as const
        ).map(({ id, label, hint }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => select(id)}
            className={cn(
              "-mb-px flex items-baseline gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              tab === id
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="hidden text-xs text-muted-foreground sm:inline">{hint}</span>
          </button>
        ))}
      </div>
      {tab === "trends" ? <TrendsTab /> : <SearchTab />}
    </div>
  );
}
