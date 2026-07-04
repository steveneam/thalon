export { extractVisibleText, selfContainmentViolations } from "./html";
export {
  webPageDraftMetaSchema,
  webPageShellOutputSchema,
  type WebPageDraftMeta,
  type WebPageShellOutput,
} from "./schemas";
export {
  createFakeWebPageDriver,
  gatewayWebPageDriver,
  webPagePromptVersion,
  type GenerateWebPageRequest,
  type WebPageCall,
  type WebPageDriver,
} from "./shell/generator";
export { generateValidatedWebPage, type WebPageCallResult } from "./validate-shell-output";
export { runWebPageGeneration, type WebPageDeps, type WebPageRequest, type WebPageResult } from "./webpage";
export type { DeployTarget, WebPageDeployOutcome, WebPageDeployRequest } from "./deploy-target";
export { createFakeDeployTarget, type FakeDeployTarget, type FakeDeployTargetDeps } from "./fake-deploy-target";
export { deployWebPage, type DeployWebPageDeps, type DeployWebPageResult } from "./deploy";
