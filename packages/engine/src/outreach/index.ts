export {
  runOutreachEmail,
  type OutreachEmailDeps,
  type OutreachEmailRequest,
  type OutreachEmailResult,
} from "./compose";
export { outreachEmailShellOutputSchema, type OutreachEmailShellOutput } from "./schemas";
export {
  createFakeOutreachEmailDriver,
  gatewayOutreachEmailDriver,
  outreachEmailPromptVersion,
  type GenerateOutreachEmailRequest,
  type OutreachEmailCall,
  type OutreachEmailDriver,
} from "./shell/generator";
export {
  generateValidatedOutreachEmail,
  type OutreachEmailCallResult,
} from "./validate-shell-output";
