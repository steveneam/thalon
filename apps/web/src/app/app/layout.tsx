import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

/** Operator surface — never indexed (robots.ts disallows /app as well). */
export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
