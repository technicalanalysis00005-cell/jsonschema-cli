/**
 * json-schema-validator-cli
 * Public API
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Validator } = require('./validator');

/**
 * Validate data against a schema object
 */
function validate(schema, data, options = {}) {
  const v = new Validator(options);
  return v.validate(schema, data);
}

/**
 * Validate a JSON file against a schema file
 */
async function validateFile(schemaPath, dataPath, options = {}) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  return {
    file: dataPath,
    ...validate(schema, data, options)
  };
}

/**
 * Validate multiple data files against a schema
 */
async function validateFiles(schemaPath, dataPaths, options = {}) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const results = [];

  for (const dp of dataPaths) {
    try {
      const data = JSON.parse(fs.readFileSync(dp, 'utf-8'));
      results.push({
        file: dp,
        ...validate(schema, data, options)
      });
    } catch (err) {
      results.push({
        file: dp,
        valid: false,
        errors: [{ path: '#', message: `Failed to read file: ${err.message}`, keyword: 'error', params: {} }]
      });
    }
  }

  return results;
}

/**
 * Get schema metadata/info
 */
function schemaInfo(schemaPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const draft = schema.$schema || '(not specified)';

  const info = {
    file: schemaPath,
    title: schema.title || null,
    description: schema.description || null,
    type: schema.type || null,
    draft: draft,
    properties: schema.properties ? Object.keys(schema.properties) : [],
    required: schema.required || [],
    hasDefinitions: !!(schema.definitions || schema.$defs),
    defCount: Object.keys(schema.definitions || schema.$defs || {}).length
  };

  return info;
}

/**
 * Generate a sample JSON value from a schema
 */
function generateSample(schema, depth = 0) {
  if (depth > 10) return null;
  if (!schema) return null;

  // Handle $ref (basic)
  if (schema.$ref && schema.$ref.startsWith('#')) {
    return null; // simplified — would need root schema
  }

  // Use default if provided
  if (schema.default !== undefined) return schema.default;
  if (schema.examples !== undefined && schema.examples.length > 0) return schema.examples[0];
  if (schema.enum !== undefined && schema.enum.length > 0) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;

  const type = schema.type;

  if (type === 'string') {
    if (schema.format === 'date-time') return '2024-01-15T10:30:00Z';
    if (schema.format === 'date') return '2024-01-15';
    if (schema.format === 'time') return '10:30:00';
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'uri') return 'https://example.com';
    if (schema.format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000';
    if (schema.pattern) return `<matches ${schema.pattern}>`;
    if (schema.minLength && schema.minLength > 0) return 'a'.repeat(schema.minLength);
    return 'string';
  }

  if (type === 'integer') {
    if (schema.minimum !== undefined) return schema.minimum;
    if (schema.enum) return schema.enum[0];
    return 0;
  }

  if (type === 'number') {
    if (schema.minimum !== undefined) return schema.minimum;
    return 0.0;
  }

  if (type === 'boolean') return true;

  if (type === 'null') return null;

  if (type === 'array') {
    const itemSchema = schema.items;
    if (itemSchema) {
      return [generateSample(itemSchema, depth + 1)];
    }
    return [];
  }

  if (type === 'object' || schema.properties) {
    const obj = {};
    const props = schema.properties || {};
    for (const [key, propSchema] of Object.entries(props)) {
      obj[key] = generateSample(propSchema, depth + 1);
    }
    return obj;
  }

  // allOf — merge results
  if (schema.allOf) {
    let merged = {};
    for (const sub of schema.allOf) {
      const sample = generateSample(sub, depth + 1);
      if (typeof sample === 'object' && sample !== null && !Array.isArray(sample)) {
        Object.assign(merged, sample);
      }
    }
    return Object.keys(merged).length > 0 ? merged : null;
  }

  return null;
}

module.exports = { validate, validateFile, validateFiles, schemaInfo, generateSample, Validator };
