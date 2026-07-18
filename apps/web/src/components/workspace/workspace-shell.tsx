"use client";

import { CommandPalette } from "@/components/workspace/command-palette";
import { PulseProvider } from "@/components/workspace/pulse-context";
import { Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";

/**
 * The workspace shell (Phase D spine design): icon rail + top bar around
 * every /app surface. The rail stays at every width — narrow screens stack
 * the content, never the chrome — so the old mobile nav strip is retired.
 */
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <PulseProvider>
      {/* Chrome tab-stops precede content on every surface — keyboard and
          SR users get the standard bypass (critique s39, Sam persona). */}
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen w-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="workspace-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
    </PulseProvider>
  );
}
