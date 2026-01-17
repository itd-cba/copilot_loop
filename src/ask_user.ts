export type AskUserErrorCode =
  | 'ELICITATION_UNSUPPORTED'
  | 'INVALID_REQUESTED_SCHEMA'
  | 'ELICITATION_IN_PROGRESS'
  | 'ELICITATION_FAILED';

export type AskUserToolError = {
  code: AskUserErrorCode;
  message: string;
};

export type AskUserToolResult =
  | {
      status: 'ok';
      action: 'accept' | 'decline' | 'cancel';
      content: Record<string, unknown> | null;
      raw: unknown | null;
    }
  | {
      status: 'error';
      action: null;
      content: null;
      raw: null;
      error: AskUserToolError;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toolError(
  code: AskUserErrorCode,
  message: string,
): AskUserToolResult {
  return {
    status: 'error',
    action: null,
    content: null,
    raw: null,
    error: { code, message },
  };
}

export function normalizeElicitationResult(result: unknown): AskUserToolResult {
  if (!isPlainObject(result)) {
    return toolError(
      'ELICITATION_FAILED',
      'Invalid elicitation response shape (expected object).',
    );
  }

  const action = result.action;
  if (action !== 'accept' && action !== 'decline' && action !== 'cancel') {
    return toolError(
      'ELICITATION_FAILED',
      `Invalid elicitation action: ${String(action)}`,
    );
  }

  if (action === 'accept') {
    const content = result.content;
    if (!isPlainObject(content)) {
      return toolError(
        'ELICITATION_FAILED',
        'Elicitation accepted but content is missing or invalid.',
      );
    }
    return { status: 'ok', action: 'accept', content, raw: result };
  }

  return { status: 'ok', action, content: null, raw: result };
}

export function errorUnsupported(): AskUserToolResult {
  return toolError(
    'ELICITATION_UNSUPPORTED',
    'Client does not support form elicitation.',
  );
}

export function errorInvalidRequestedSchema(reason: string): AskUserToolResult {
  const suffix = reason.trim().length > 0 ? ` ${reason.trim()}` : '';
  return toolError(
    'INVALID_REQUESTED_SCHEMA',
    `requestedSchema is invalid.${suffix}`,
  );
}

export function errorInProgress(): AskUserToolResult {
  return toolError(
    'ELICITATION_IN_PROGRESS',
    'Another elicitation is already in progress.',
  );
}
