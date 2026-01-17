import test from 'node:test';
import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createAskToolMcpServer } from '../dist/server.js';

test('capability gating: disables ask_user when client lacks elicitation.form', async () => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    {
      capabilities: {},
    },
  );

  const { mcpServer } = createAskToolMcpServer();

  await Promise.all([
    client.connect(clientTransport),
    mcpServer.connect(serverTransport),
  ]);

  await new Promise((r) => setTimeout(r, 0));

  const tools = await client.listTools();
  assert.equal(
    tools.tools.some((t) => t.name === 'ask_user'),
    false,
  );

  await Promise.all([client.close(), mcpServer.close()]);
});

test('capability gating: keeps ask_user when client supports elicitation.form', async () => {
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

  const { mcpServer } = createAskToolMcpServer();

  await Promise.all([
    client.connect(clientTransport),
    mcpServer.connect(serverTransport),
  ]);

  await new Promise((r) => setTimeout(r, 0));

  const tools = await client.listTools();
  assert.equal(
    tools.tools.some((t) => t.name === 'ask_user'),
    true,
  );

  await Promise.all([client.close(), mcpServer.close()]);
});
