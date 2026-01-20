import { z } from 'zod';

export const ASK_USER_TOOL_DESCRIPTION = `Ask the human user a question via MCP elicitation (client/elicitation, elicitation/create) using form mode.

CRITICAL UX RULE (must follow):
- The elicitation "message" is rendered as a single-line title in the input UI. Newlines will not render and long text may be truncated.
- Keep the tool "message" <= 120 characters and do not include \n.
- For long questions (> 120 chars): put the full question text in the property "title" field of requestedSchema. The UI shows a tooltip on hover when truncated.

IMPORTANT usage rule:
- Use this tool ONLY to ask the human for missing information (i.e., to collect form input).
- Do NOT use this tool to reply/explain/confirm results to the user; write those in normal assistant chat messages.

Contract (how to interpret results):
- The user can: accept (submit the form), decline (refuse to answer), or cancel (dismiss).
- If action === "accept", content is an object with keys matching requestedSchema.properties.
- If action !== "accept", content is null.

See the requestedSchema argument description for the supported schema subset, best practices, and copy/paste examples.`;

export const ASK_USER_MODE_DESCRIPTION =
  'Elicitation mode. Only "form" is supported.';
export const ASK_USER_MESSAGE_DESCRIPTION =
  'Single-line title shown in the client UI. MUST be <= 120 chars and contain no newlines. For long questions, put the full text in property "title" fields instead.';
export const ASK_USER_REQUESTED_SCHEMA_DESCRIPTION = `Schema for the form fields (restricted JSON Schema subset).

Rules / supported subset:
- Must be: type:"object" with flat properties (no nested objects).
- Supported property types: string, number, integer, boolean, and multi-select arrays of strings.
- Single-select choices: prefer string.enum (some clients may not support string.oneOf).
- Multi-select choices: type:"array" with items.{type:"string", enum:[...]} OR items.anyOf:[{const,title}].
- Use \`required\` to require fields.

Long question text (REQUIRED best practice):
- Put the FULL question text in the property's "title" field. The UI shows a tooltip on hover when title is truncated, so users can read the complete question.
- If your question exceeds 120 characters, do NOT put it in the tool "message" — put it in the property "title" instead.

Freeform alongside choices (REQUIRED best practice):
- If you offer choices, ALWAYS include an additional freeform string field (e.g., <key>_freeform) with NO maxLength.
- Include an "Other" sentinel in the choice field and use <key>_freeform when the user selects Other.

Examples (tool inputs) — copy/paste and adjust (keep them in-sync with the rules above):

1) Single required string (+ always-available freeform):
{
  "message": "What is your project name?",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "projectName": { "type": "string", "minLength": 1, "title": "Project name" },
      "projectName_freeform": { "type": "string", "title": "Project name (freeform)", "description": "Optional extra context. No length limit." }
    },
    "required": ["projectName"]
  }
}

2) Single-select via enum (+ always-available freeform):
{
  "message": "Which environment should we deploy to?",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "environment": {
        "type": "string",
        "enum": ["dev", "staging", "prod", "Other"],
        "description": "Select one. If you select Other, fill environment_freeform."
      },
      "environment_freeform": {
        "type": "string",
        "title": "Environment (freeform)",
        "description": "Optional. If environment is Other, specify the environment name. No length limit."
      }
    },
    "required": ["environment"]
  }
}

3) Multi-select array of choices (items.anyOf) (+ always-available freeform):
{
  "message": "Select the languages you want (you can choose multiple).",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "languages": {
        "type": "array",
        "items": {
          "anyOf": [
            { "const": "ts", "title": "TypeScript" },
            { "const": "js", "title": "JavaScript" },
            { "const": "py", "title": "Python" }
          ]
        },
        "minItems": 0,
        "maxItems": 3
      },
      "languages_freeform": {
        "type": "string",
        "title": "Other languages (freeform)",
        "description": "Optional. Add anything not in the list. No length limit."
      }
    }
  }
}

4) Choices PLUS always-available freeform (recommended pattern):
{
  "message": "Pick a deployment target, or type your own.",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "target": {
        "type": "string",
        "enum": ["k8s", "ecs", "lambda", "Other"],
        "description": "Select one option. If you select Other, fill target_freeform."
      },
      "target_freeform": {
        "type": "string",
        "title": "Target (freeform)",
        "description": "Optional. If target is Other, put the real target here. No length limit."
      }
    },
    "required": ["target"]
  }
}

5) Multi-field form (mix types) + always-available freeform notes:
{
  "message": "A few quick config questions.",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "port": { "type": "integer", "minimum": 1, "maximum": 65535, "default": 3000 },
      "enableAuth": { "type": "boolean", "default": true },
      "notes_freeform": { "type": "string", "title": "Notes (freeform)", "description": "Anything else to add. No length limit." }
    },
    "required": ["port"]
  }
}

6) Long questions in property title (when question > 120 chars):
{
  "message": "Answer the questions below (hover for full text):",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "answer1": {
        "type": "string",
        "title": "This is a very long question that exceeds 120 characters. What is your favorite programming language and why do you prefer it over other languages? Please share your thoughts in detail."
      },
      "answer2": {
        "type": "string",
        "title": "Here is another lengthy question. What improvements would you like to see in developer tooling over the next five years? Consider AI assistance, debugging, testing, and deployment."
      },
      "answer2_freeform": {
        "type": "string",
        "title": "Additional thoughts (freeform)",
        "description": "Optional. Add anything else. No length limit."
      }
    },
    "required": ["answer1"]
  }
}`;

export const askUserArgsSchema = z
  .object({
    mode: z.literal('form').optional().describe(ASK_USER_MODE_DESCRIPTION),
    message: z
      .string()
      .min(1)
      .max(120)
      .refine((s) => !/[\r\n]/.test(s), {
        message: 'message must be a single line (no newlines)',
      })
      .describe(ASK_USER_MESSAGE_DESCRIPTION),
    requestedSchema: z
      .unknown()
      .describe(ASK_USER_REQUESTED_SCHEMA_DESCRIPTION),
  })
  .strict();

export type AskUserArgs = z.infer<typeof askUserArgsSchema>;
