/**
 * JSON Schema $ref resolver
 */

'use strict';

function resolveRef(ref, rootSchema) {
  if (!ref || !rootSchema) return null;

  // Handle fragments-only refs
  if (ref.startsWith('#')) {
    return resolveJsonPointer(ref, rootSchema);
  }

  return null;
}

function resolveJsonPointer(pointer, doc) {
  if (pointer === '#') return doc;
  if (!pointer.startsWith('#')) return null;

  const parts = pointer.slice(2).split('/').map(p =>
    p.replace(/~1/g, '/').replace(/~0/g, '~')
  );

  let current = doc;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return null;
    }
    current = current[part];
  }

  return current;
}

function getSchemaDraft(schema) {
  if (!schema || !schema.$schema) return null;

  const schemaUri = schema.$schema;
  if (schemaUri.includes('draft-04')) return 4;
  if (schemaUri.includes('draft-06')) return 6;
  if (schemaUri.includes('draft-07')) return 7;
  if (schemaUri.includes('2020-12')) return 2020;
  if (schemaUri.includes('2019-09')) return 2019;
  return null;
}

function resolveSchema(schema) {
  // Resolve $id / id
  return schema.$id || schema.id || null;
}

module.exports = { resolveRef, resolveJsonPointer, getSchemaDraft, resolveSchema };
