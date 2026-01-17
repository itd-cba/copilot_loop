import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRequestedSchema } from '../dist/elicitation_schema.js';

test('validateRequestedSchema: accepts basic string + required', () => {
  const result = validateRequestedSchema({
    type: 'object',
    properties: {
      projectName: { type: 'string', minLength: 1, maxLength: 50 },
    },
    required: ['projectName'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.type, 'object');
  assert.equal(result.value.properties.projectName.type, 'string');
});

test('validateRequestedSchema: rejects nested objects', () => {
  const result = validateRequestedSchema({
    type: 'object',
    properties: {
      nested: { type: 'object', properties: { a: { type: 'string' } } },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_REQUESTED_SCHEMA');
});

test('validateRequestedSchema: accepts enum single-select via oneOf', () => {
  const result = validateRequestedSchema({
    type: 'object',
    properties: {
      environment: {
        type: 'string',
        oneOf: [
          { const: 'dev', title: 'Development' },
          { const: 'prod', title: 'Production' },
        ],
      },
    },
    required: ['environment'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.properties.environment.type, 'string');
});

test('validateRequestedSchema: accepts enum multi-select arrays via items.anyOf', () => {
  const result = validateRequestedSchema({
    type: 'object',
    properties: {
      languages: {
        type: 'array',
        items: {
          anyOf: [
            { const: 'ts', title: 'TypeScript' },
            { const: 'js', title: 'JavaScript' },
          ],
        },
        minItems: 0,
        maxItems: 2,
        default: ['ts'],
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.properties.languages.type, 'array');
});

test('validateRequestedSchema: rejects arrays without enum items', () => {
  const result = validateRequestedSchema({
    type: 'object',
    properties: {
      bad: { type: 'array', items: { type: 'string' } },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_REQUESTED_SCHEMA');
});
