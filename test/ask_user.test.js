import test from 'node:test';
import assert from 'node:assert/strict';

import {
  errorInProgress,
  errorInvalidRequestedSchema,
  errorUnsupported,
  normalizeElicitationResult,
  toolError,
} from '../dist/ask_user.js';

test('normalizeElicitationResult: accept returns content', () => {
  const result = normalizeElicitationResult({
    action: 'accept',
    content: { a: 1 },
  });

  assert.deepEqual(result, {
    status: 'ok',
    action: 'accept',
    content: { a: 1 },
    raw: { action: 'accept', content: { a: 1 } },
  });
});

test('normalizeElicitationResult: cancel returns ok/cancel with no content', () => {
  const result = normalizeElicitationResult({ action: 'cancel' });
  assert.equal(result.status, 'ok');
  assert.equal(result.action, 'cancel');
  assert.equal(result.content, null);
});

test('normalizeElicitationResult: decline returns ok/decline with no content', () => {
  const result = normalizeElicitationResult({ action: 'decline' });
  assert.equal(result.status, 'ok');
  assert.equal(result.action, 'decline');
  assert.equal(result.content, null);
});

test('normalizeElicitationResult: accept without object content -> ELICITATION_FAILED', () => {
  const result = normalizeElicitationResult({ action: 'accept', content: 'x' });
  assert.equal(result.status, 'error');
  assert.equal(result.error.code, 'ELICITATION_FAILED');
});

test('error helpers: codes and message prefixes', () => {
  assert.equal(
    toolError('ELICITATION_FAILED', 'x').error.code,
    'ELICITATION_FAILED',
  );
  assert.equal(errorUnsupported().error.code, 'ELICITATION_UNSUPPORTED');
  assert.equal(errorInProgress().error.code, 'ELICITATION_IN_PROGRESS');
  assert.equal(
    errorInvalidRequestedSchema('nested object').error.code,
    'INVALID_REQUESTED_SCHEMA',
  );
  assert.match(
    errorInvalidRequestedSchema('nested object').error.message,
    /^requestedSchema is invalid\./,
  );
});
