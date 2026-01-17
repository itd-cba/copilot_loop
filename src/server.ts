import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProgressNotification } from '@modelcontextprotocol/sdk/types.js';

import {
  errorInProgress,
  errorInvalidRequestedSchema,
  errorUnsupported,
  normalizeElicitationResult,
  toolError,
} from './ask_user.js';
import { validateRequestedSchema } from './elicitation_schema.js';
import { ASK_USER_TOOL_DESCRIPTION, askUserArgsSchema } from './tool_schema.js';

export type AskToolMcpOptions = {
  debug?: boolean;
  progressIntervalMs?: number;
  elicitationTimeoutMs?: number;
};

function debugLog(debug: boolean, message: string, extra?: unknown) {
  if (!debug) return;
  console.error(`[copilot_loop] ${message}`, extra ?? '');
}

function startProgressNotifications(
  intervalMs: number,
  progressToken: string | number,
  extra: {
    sendNotification: (notification: ProgressNotification) => Promise<void>;
    signal: AbortSignal;
  },
) {
  let progress = 0;
  let stopped = false;

  const send = () => {
    if (stopped) return;
    if (extra.signal.aborted) return;
    progress += 1;
    void extra
      .sendNotification({
        method: 'notifications/progress',
        params: {
          progressToken,
          progress,
          message: 'Waiting for user input...',
        },
      })
      .catch(() => {
        // Best-effort.
      });
  };

  send(); // immediate first progress update
  const timer = setInterval(send, intervalMs);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  };

  extra.signal.addEventListener('abort', stop, { once: true });
  return stop;
}

export function createAskToolMcpServer(options: AskToolMcpOptions = {}) {
  const debug = options.debug ?? false;
  const progressIntervalMs = options.progressIntervalMs ?? 5000;
  const elicitationTimeoutMs =
    options.elicitationTimeoutMs ?? 24 * 60 * 60 * 1000;

  const mcpServer = new McpServer({
    name: 'copilot_loop',
    version: '0.1.0',
  });

  let inFlight = false;

  const askUserTool = mcpServer.registerTool(
    'ask_user',
    {
      description: ASK_USER_TOOL_DESCRIPTION,
      inputSchema: askUserArgsSchema,
    },
    async ({ mode, message, requestedSchema }, extra) => {
      if (extra.signal.aborted) {
        return toToolTextResult({
          status: 'ok',
          action: 'cancel',
          content: null,
          raw: null,
        });
      }
      if (inFlight) return toToolTextResult(errorInProgress());

      const capabilities = mcpServer.server.getClientCapabilities();
      const supportsFormElicitation = !!capabilities?.elicitation?.form;
      if (!supportsFormElicitation) return toToolTextResult(errorUnsupported());

      const validated = validateRequestedSchema(requestedSchema);
      if (!validated.ok)
        return toToolTextResult(
          errorInvalidRequestedSchema(validated.error.message),
        );

      inFlight = true;
      let stopProgress: () => void = () => {};
      try {
        const progressToken = extra._meta?.progressToken;
        if (progressToken !== undefined) {
          stopProgress = startProgressNotifications(
            progressIntervalMs,
            progressToken,
            extra,
          );
        }

        const elicitationResult = await mcpServer.server.elicitInput(
          {
            mode,
            message,
            requestedSchema: validated.value,
          },
          { signal: extra.signal, timeout: elicitationTimeoutMs },
        );
        return toToolTextResult(normalizeElicitationResult(elicitationResult));
      } catch (error) {
        if (extra.signal.aborted) {
          return toToolTextResult({
            status: 'ok',
            action: 'cancel',
            content: null,
            raw: null,
          });
        }
        if (error && typeof error === 'object') {
          const code =
            'code' in error ? (error as { code?: unknown }).code : undefined;
          const message =
            'message' in error
              ? String((error as { message?: unknown }).message)
              : '';
          if (
            code === -32603 &&
            /elicitation request is already in progress/i.test(message)
          ) {
            return toToolTextResult(
              toolError(
                'ELICITATION_IN_PROGRESS',
                'Another elicitation is already in progress in the client UI. Close it or wait, then try again.',
              ),
            );
          }
        }
        debugLog(debug, 'elicitation failed', error);
        return toToolTextResult(
          toolError(
            'ELICITATION_FAILED',
            `Elicitation request failed: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      } finally {
        stopProgress();
        inFlight = false;
      }
    },
  );

  mcpServer.server.oninitialized = () => {
    const capabilities = mcpServer.server.getClientCapabilities();
    const supportsFormElicitation = !!capabilities?.elicitation?.form;
    if (!supportsFormElicitation) {
      debugLog(
        debug,
        'client lacks elicitation.form; disabling ask_user tool',
        capabilities,
      );
      askUserTool.disable();
    }
  };

  return { mcpServer, askUserTool };
}

function toToolTextResult(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
