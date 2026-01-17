import test from 'node:test';
import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { createAskToolMcpServer } from '../dist/server.js';

test('tool cancellation releases inFlight; next call succeeds', async () => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    {
      capabilities: {
        elicitation: { form: {} },
      },
    },
  );

  let elicitationCallCount = 0;
  client.setRequestHandler(ElicitRequestSchema, async (_request, extra) => {
    elicitationCallCount += 1;

    if (elicitationCallCount === 1) {
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 30_000);
        extra.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(t);
            resolve();
          },
          { once: true },
        );
      });
      return { action: 'cancel' };
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
    return { action: 'accept', content: { ok: true } };
  });

  const { mcpServer } = createAskToolMcpServer({ progressIntervalMs: 10 });

  await Promise.all([
    client.connect(clientTransport),
    mcpServer.connect(serverTransport),
  ]);

  let progressCount = 0;
  const abortController = new AbortController();

  const first = client.callTool(
    {
      name: 'ask_user',
      arguments: {
        mode: 'form',
        message: 'x',
        requestedSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
    },
    undefined,
    {
      signal: abortController.signal,
      onprogress: () => {
        progressCount += 1;
      },
      resetTimeoutOnProgress: true,
      timeout: 60_000,
    },
  );

  setTimeout(() => abortController.abort('client timeout'), 30);

  await assert.rejects(first);
  assert.ok(progressCount >= 1);

  // Give the server a moment to unwind and release inFlight.
  await new Promise((r) => setTimeout(r, 20));

  const second = await client.callTool(
    {
      name: 'ask_user',
      arguments: {
        mode: 'form',
        message: 'x',
        requestedSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
    },
    undefined,
    {
      timeout: 2_000,
    },
  );

  assert.equal(second.isError, undefined);
  assert.equal(second.content[0].type, 'text');
  const payload = JSON.parse(second.content[0].text);
  assert.equal(payload.status, 'ok');
  assert.equal(payload.action, 'accept');
  assert.deepEqual(payload.content, { ok: true });

  await Promise.all([client.close(), mcpServer.close()]);
});
