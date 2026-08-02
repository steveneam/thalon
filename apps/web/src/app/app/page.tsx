import { Dashboard } from "@/components/dashboard/dashboard";

/**
 * Home's two states ride one route: `?view=board` is the pipeline board (the
 * retired /app/board's replacement, spec §5.9). The view resolves HERE so a
 * deep link server-renders the state it names — no hydration branch.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return <Dashboard initialView={view === "board" ? "board" : "overview"} />;
}
