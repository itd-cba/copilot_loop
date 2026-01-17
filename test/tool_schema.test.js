import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASK_USER_MESSAGE_DESCRIPTION,
  ASK_USER_MODE_DESCRIPTION,
  ASK_USER_REQUESTED_SCHEMA_DESCRIPTION,
  ASK_USER_TOOL_DESCRIPTION,
} from '../dist/tool_schema.js';

test('tool descriptions are present (LLM-facing docs)', () => {
  assert.ok(ASK_USER_TOOL_DESCRIPTION.length > 20);
  assert.ok(ASK_USER_MODE_DESCRIPTION.length > 10);
  assert.ok(ASK_USER_MESSAGE_DESCRIPTION.length > 10);
  assert.ok(ASK_USER_REQUESTED_SCHEMA_DESCRIPTION.length > 10);
});
