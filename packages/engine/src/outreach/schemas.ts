import { z } from "zod";

/**
 * Shell→core boundary schema for the outreach-email composer (B-crm.4 front
 * half): the generator returns exactly one subject + one email body. The
 * judged draft body is derived from BOTH pieces (subject included — the
 * recipient reads it, so the judge must too; contracts
 * `outreachEmailDraftMetaSchema.expectedBody` pins the join).
 */
export const outreachEmailShellOutputSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
});
export type OutreachEmailShellOutput = z.infer<typeof outreachEmailShellOutputSchema>;
