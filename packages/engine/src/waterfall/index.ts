export {
  deriveCandidateWindows,
  DEFAULT_WINDOW_CONFIG,
  type CandidateWindow,
  type WaterfallChunkInput,
  type WindowConfig,
} from "./windows";
export {
  clipPlanDraftMetaSchema,
  highlightSelectShellOutputSchema,
  type ClipPlanDraftMeta,
  type ClipSelection,
  type HighlightSelectShellOutput,
} from "./schemas";
export {
  generateValidatedHighlightSelect,
  type HighlightSelectCallResult,
} from "./validate-shell-output";
export {
  createFakeHighlightSelectDriver,
  gatewayHighlightSelectDriver,
  highlightSelectPromptVersion,
  type HighlightSelectCall,
  type HighlightSelectDriver,
  type HighlightSelectRequest,
} from "./shell/generator";
export { runWaterfall, type WaterfallDeps, type WaterfallRequest, type WaterfallResult } from "./waterfall";
