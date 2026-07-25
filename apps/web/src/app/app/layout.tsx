import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

/** Operator surface — never indexed (robots.ts disallows /app as well). */
export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

/**
 * Pre-paint theme stamp: on a hard load the workspace HTML must paint on
 * the Thalon theme's dark default (or the stored light preference) BEFORE
 * the client Theme provider hydrates — this script runs while the body is
 * still parsing, so there is no flash of the landing's light register.
 * The Theme provider takes over the same attributes after hydration and
 * removes them again when the operator leaves the workspace.
 */
const PRE_PAINT_THEME = `try{var m=localStorage.getItem("thalon-workspace-mode");var d=document.documentElement;d.setAttribute("data-theme",m==="light"?"light":"dark");d.setAttribute("data-astryx-theme","thalon");}catch(e){}`;

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_THEME }} />
      <WorkspaceShell>{children}</WorkspaceShell>
    </>
  );
}
