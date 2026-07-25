import { Intel, type IntelTab } from "@/components/intel/intel";
import "@/components/intel/intel.css";

/**
 * The Intel surface (exact-mock rebuild of Intel.dc.html). Reads ?tab=
 * server-side once so deep links like /app/intel?tab=search land on the
 * right tab without a useSearchParams/Suspense dance; the client surface
 * takes over from there.
 */
export default async function IntelPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const tab = (await searchParams).tab;
  const initialTab: IntelTab = tab === "search" ? "search" : "trends";
  return <Intel initialTab={initialTab} />;
}
