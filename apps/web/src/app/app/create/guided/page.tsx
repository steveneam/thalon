import { WizardContextLoader, WizardSurface } from "@/components/create/wizard-surface";
import type { CreateFamily } from "@/lib/intel/types";

/**
 * The Create wizard route (B-create.3's sheet, built s93) — the "Start
 * guided" offer beside Create home's prompt (spec R2: the wizard is an
 * offer, never a wall; both doors carry the brief back and forth so nothing
 * is re-asked). Params mirror /app/create: ?prompt= (the brief so far),
 * ?family=, ?ctx= (the intel capture spine, resolved client-side because the
 * capture store lives in the route layer).
 */
export default async function CreateGuidedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const familyParam = first(params.family);
  const family =
    familyParam === "post" ||
    familyParam === "video" ||
    familyParam === "page" ||
    familyParam === "email"
      ? (familyParam as CreateFamily)
      : undefined;
  const ctxId = first(params.ctx);
  const common = { initialPrompt: first(params.prompt), initialFamily: family };
  return ctxId ? (
    <WizardContextLoader contextId={ctxId} {...common} />
  ) : (
    <WizardSurface {...common} context={null} />
  );
}
