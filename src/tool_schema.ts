import { z } from 'zod';

export const ASK_USER_TOOL_DESCRIPTION =
  'Ask the human user a question via MCP elicitation (form mode). Provide a message and a restricted requestedSchema. For multi-field questions, put multiple properties in requestedSchema. For “select OR freeform”, use two properties: <key> (enum including "Other") and <key>_details (optional string); interpret <key>==="Other" as using <key>_details.';

export const ASK_USER_MODE_DESCRIPTION =
  'Elicitation mode. Only "form" is supported.';
export const ASK_USER_MESSAGE_DESCRIPTION =
  'Text shown to the user above the form.';
export const ASK_USER_REQUESTED_SCHEMA_DESCRIPTION =
  'Restricted JSON Schema describing the form fields (flat object, primitive fields, enum + multi-select array enums).';

export const askUserArgsSchema = z
  .object({
    mode: z.literal('form').optional().describe(ASK_USER_MODE_DESCRIPTION),
    message: z.string().min(1).max(8000).describe(ASK_USER_MESSAGE_DESCRIPTION),
    requestedSchema: z
      .unknown()
      .describe(ASK_USER_REQUESTED_SCHEMA_DESCRIPTION),
  })
  .strict();

export type AskUserArgs = z.infer<typeof askUserArgsSchema>;
