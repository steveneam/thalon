export { runFanout, type FanoutDeps, type FanoutRequest, type FanoutResult } from "./fanout";
export { loadPlatformProfile, type LoadedPlatformProfile } from "./profiles";
export { resolveRoutedPlatforms, type RoutedPlatforms } from "./routing";
export { fanoutShellOutputSchema, type FanoutShellOutput } from "./schemas";
export {
  deriveTargetTerms,
  normalizeTermList,
  MAX_TARGET_TERMS,
  type DeriveTargetTermsInput,
} from "./target-terms";
export { generateValidatedDraft, type GenerateCallResult } from "./validate-shell-output";
export {
  createFakeDraftGeneratorDriver,
  exemplarPromptVersion,
  fanoutPromptVersion,
  gatewayDraftGenerator,
  type DraftGeneratorDriver,
  type GenerateDraftCall,
  type GenerateDraftRequest,
} from "./shell/generator";
