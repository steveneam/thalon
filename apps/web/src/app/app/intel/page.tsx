import { IntelSurface, type IntelTab } from "@/components/intel/intel-surface";

/** Reads ?tab= server-side once (deep links like /app/intel?tab=search) — the client tabs take over from there. */
export default async function IntelPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const tab = (await searchParams).tab;
  const initialTab: IntelTab = tab === "search" ? "search" : "trends";
  return <IntelSurface initialTab={initialTab} />;
}
