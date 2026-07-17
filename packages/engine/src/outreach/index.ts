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
export { deriveCadence, isSendDay, utcDayKey, type CadenceState } from "./cadence";
export {
  ConsentRefusedError,
  DailyCapReachedError,
  DraftAlreadySentError,
  DraftNotApprovedError,
  LeadNotContactableError,
  NotSendableFormatError,
  NotSendDayError,
  OutreachDisarmedError,
  SenderIdentityError,
  SendRefusedError,
  SequenceCompleteError,
  TouchNotDueError,
} from "./errors";
export {
  createResendTransport,
  ResendApiError,
  type ResendTransportConfig,
} from "./resend-driver";
export {
  sendApprovedEmail,
  type SendApprovedEmailDeps,
  type SendApprovedEmailRequest,
  type SendApprovedEmailResult,
} from "./send";
export {
  createFakeSendTransport,
  resolveSendTransport,
  TransportDisarmedError,
  type FakeSendTransport,
  type ResolveSendTransportOptions,
  type SendEmailInput,
  type SendTransport,
} from "./transport";
