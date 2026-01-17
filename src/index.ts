#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createAskToolMcpServer } from './server.js';

const ASK_USER_DEBUG = process.env.ASK_USER_DEBUG === '1';
const ASK_USER_PROGRESS_INTERVAL_MS = parsePositiveInt(
  process.env.ASK_USER_PROGRESS_INTERVAL_MS,
);
const ASK_USER_ELICITATION_TIMEOUT_MS = parsePositiveInt(
  process.env.ASK_USER_ELICITATION_TIMEOUT_MS,
);

function debugLog(message: string, extra?: unknown) {
  if (!ASK_USER_DEBUG) return;
  // Avoid spamming; single-line, best-effort.
  console.error(`[copilot_loop] ${message}`, extra ?? '');
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (!Number.isInteger(parsed)) return undefined;
  if (parsed <= 0) return undefined;
  return parsed;
}

async function main() {
  const { mcpServer, askUserTool } = createAskToolMcpServer({
    debug: ASK_USER_DEBUG,
    progressIntervalMs: ASK_USER_PROGRESS_INTERVAL_MS,
    elicitationTimeoutMs: ASK_USER_ELICITATION_TIMEOUT_MS,
  });

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  process.stdin.on('end', () => {
    debugLog('stdin closed; exiting');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    debugLog('SIGINT; exiting');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
