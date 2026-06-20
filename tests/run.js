#!/usr/bin/env node

/**
 * Test suite for json-schema-validator-cli
 */

'use strict';

const path = require('path');
const { validate, validateFile, schemaInfo, generateSample } = require('../src/index');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✔ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

function assertEqual(a, b, name) {
  assert(JSON.stringify(a) === JSON.stringify(b), name);
}

console.log('\n  json-schema-validator tests\n');

// ========================================
// Type validation
// ========================================
{
  const schema = { type: 'string' };
  assert(validate(schema, 'hello').valid, 'type: string valid');
  assert(!validate(schema, 123).valid, 'type: string rejects number');
  assert(!validate(schema, null).valid, 'type: string rejects null');
}

{
  const schema = { type: 'integer' };
  assert(validate(schema, 42).valid, 'type: integer valid');
  assert(!validate(schema, 3.14).valid, 'type: integer rejects float');
  assert(!validate(schema, '42').valid, 'type: integer rejects string');
}

{
  const schema = { type: ['string', 'null'] };
  assert(validate(schema, 'hello').valid, 'type: multi-type valid string');
  assert(validate(schema, null).valid, 'type: multi-type valid null');
  assert(!validate(schema, 42).valid, 'type: multi-type rejects number');
}

// ========================================
// String validations
// ========================================
{
  const schema = { type: 'string', minLength: 2, maxLength: 5 };
  assert(validate(schema, 'abc').valid, 'string: length in range');
  assert(!validate(schema, 'a').valid, 'string: too short');
  assert(!validate(schema, 'abcdef').valid, 'string: too long');
}

{
  const schema = { type: 'string', pattern: '^[a-z]+$' };
  assert(validate(schema, 'hello').valid, 'string: pattern match');
  assert(!validate(schema, 'Hello123').valid, 'string: pattern mismatch');
}

{
  const schema = { type: 'string', format: 'email' };
  assert(validate(schema, 'user@example.com').valid, 'string: email format');
  assert(!validate(schema, 'not-an-email').valid, 'string: bad email format');
}

// ========================================
// Number validations
// ========================================
{
  const schema = { type: 'number', minimum: 0, maximum: 100 };
  assert(validate(schema, 50).valid, 'number: in range');
  assert(validate(schema, 0).valid, 'number: at minimum');
  assert(validate(schema, 100).valid, 'number: at maximum');
  assert(!validate(schema, -1).valid, 'number: below minimum');
  assert(!validate(schema, 101).valid, 'number: above maximum');
}

{
  const schema = { type: 'number', multipleOf: 5 };
  assert(validate(schema, 15).valid, 'number: multiple of 5');
  assert(!validate(schema, 7).valid, 'number: not multiple of 5');
}

// ========================================
// Array validations
// ========================================
{
  const schema = { type: 'array', items: { type: 'number' }, minItems: 1, maxItems: 3 };
  assert(validate(schema, [1, 2]).valid, 'array: valid items');
  assert(!validate(schema, [1, 'a']).valid, 'array: bad item type');
  assert(!validate(schema, []).valid, 'array: too few items');
  assert(!validate(schema, [1, 2, 3, 4]).valid, 'array: too many items');
}

{
  const schema = { type: 'array', uniqueItems: true };
  assert(validate(schema, [1, 2, 3]).valid, 'array: unique items');
  assert(!validate(schema, [1, 2, 2]).valid, 'array: duplicate items');
}

// ========================================
// Object validations
// ========================================
{
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer', minimum: 0 }
    },
    required: ['name']
  };
  assert(validate(schema, { name: 'Alice', age: 30 }).valid, 'object: valid');
  assert(validate(schema, { name: 'Bob' }).valid, 'object: optional fields');
  assert(!validate(schema, { age: 30 }).valid, 'object: missing required');
  assert(!validate(schema, { name: 'C', age: -5 }).valid, 'object: invalid field');
}

{
  const schema = {
    type: 'object',
    properties: { x: { type: 'number' } },
    additionalProperties: false
  };
  assert(validate(schema, { x: 1 }).valid, 'object: no additional props');
  assert(!validate(schema, { x: 1, y: 2 }).valid, 'object: additional prop rejected');
}

// ========================================
// Enum & const
// ========================================
{
  const schema = { enum: ['a', 'b', 'c'] };
  assert(validate(schema, 'a').valid, 'enum: match');
  assert(!validate(schema, 'd').valid, 'enum: no match');
}

{
  const schema = { const: 42 };
  assert(validate(schema, 42).valid, 'const: match');
  assert(!validate(schema, 43).valid, 'const: no match');
}

// ========================================
// allOf, anyOf, oneOf, not
// ========================================
{
  const schema = {
    allOf: [
      { type: 'number' },
      { minimum: 0 }
    ]
  };
  assert(validate(schema, 5).valid, 'allOf: both pass');
  assert(!validate(schema, -1).valid, 'allOf: second fails');
}

{
  const schema = {
    anyOf: [
      { type: 'string' },
      { type: 'number' }
    ]
  };
  assert(validate(schema, 'hi').valid, 'anyOf: string match');
  assert(validate(schema, 42).valid, 'anyOf: number match');
  assert(!validate(schema, true).valid, 'anyOf: no match');
}

{
  const schema = {
    oneOf: [
      { type: 'string' },
      { type: 'number' }
    ]
  };
  assert(validate(schema, 'hi').valid, 'oneOf: exactly one');
  assert(!validate(schema, true).valid, 'oneOf: none match');
}

{
  const schema = { not: { type: 'string' } };
  assert(validate(schema, 42).valid, 'not: non-string passes');
  assert(!validate(schema, 'hi').valid, 'not: string fails');
}

// ========================================
// if/then/else (draft 7)
// ========================================
{
  const schema = {
    type: 'object',
    properties: { type: { type: 'string' } },
    if: { properties: { type: { const: 'admin' } } },
    then: { required: ['password'] },
    else: { required: ['email'] }
  };
  assert(validate(schema, { type: 'admin', password: 'x' }).valid, 'if/then: admin with password');
  assert(!validate(schema, { type: 'admin' }).valid, 'if/then: admin without password');
  assert(validate(schema, { type: 'user', email: 'x' }).valid, 'if/else: user with email');
  assert(!validate(schema, { type: 'user' }).valid, 'if/else: user without email');
}

// ========================================
// Error paths
// ========================================
{
  const schema = {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        },
        required: ['email']
      }
    },
    required: ['user']
  };

  const r1 = validate(schema, {});
  assert(r1.errors.length > 0, 'errors: missing root required');
  assert(r1.errors[0].path === '#', 'errors: root path');

  const r2 = validate(schema, { user: {} });
  assert(r2.errors.length > 0, 'errors: nested missing required');

  const r3 = validate(schema, { user: { email: 'bad' } });
  assert(r3.errors.length > 0, 'errors: bad format');
}

// ========================================
// Sample generation
// ========================================
{
  const sample = generateSample({ type: 'string', format: 'email' });
  assertEqual(sample, 'user@example.com', 'sample: email format');

  const sampleObj = generateSample({
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' }
    }
  });
  assert(typeof sampleObj === 'object', 'sample: object type');
  assertEqual(sampleObj.name, 'string', 'sample: string field');
  assertEqual(sampleObj.age, 0, 'sample: integer field');
}

// ========================================
// Summary
// ========================================
console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
