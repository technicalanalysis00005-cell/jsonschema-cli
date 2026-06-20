/**
 * JSON Schema Validator — core validation engine
 * Supports Draft 4, 6, 7, and 2020-12
 * Zero external dependencies
 */

'use strict';

const { resolveRef, resolveSchema, getSchemaDraft } = require('./resolver');
const { jsonPointer, joinPath } = require('./utils');

class Validator {
  constructor(options = {}) {
    this.strict = options.strict || false;
    this.draft = options.draft || null; // null = auto-detect
    this.errors = [];
    this.schemas = new Map(); // cached schemas by $id
    this.maxErrors = options.maxErrors || 100;
  }

  validate(schema, data) {
    this.errors = [];
    this.rootSchema = schema;
    this._validate(schema, data, '#');
    return {
      valid: this.errors.length === 0,
      errors: this.errors.slice(0, this.maxErrors).map(e => ({
        path: e.path,
        message: e.message,
        keyword: e.keyword,
        params: e.params
      }))
    };
  }

  _validate(schema, data, path) {
    if (!schema || typeof schema !== 'object') return;

    // Handle $ref
    if (schema.$ref) {
      const resolved = resolveRef(schema.$ref, this.rootSchema);
      if (resolved) {
        this._validate(resolved, data, path);
      } else {
        this._addErr(path, `$ref "${schema.$ref}" could not be resolved`, '$ref', { ref: schema.$ref });
      }
      return;
    }

    // Type validation
    if (schema.type !== undefined) {
      this._checkType(schema, data, path);
    }

    // Enum
    if (schema.enum !== undefined) {
      const match = schema.enum.some(v => deepEqual(v, data));
      if (!match) {
        this._addErr(path, `must be one of: ${JSON.stringify(schema.enum)}`, 'enum', { allowed: schema.enum });
      }
    }

    // Const (draft 6+)
    if (schema.const !== undefined) {
      if (!deepEqual(schema.const, data)) {
        this._addErr(path, `must be ${JSON.stringify(schema.const)}`, 'const', { expected: schema.const });
      }
    }

    // String validations
    if (typeof data === 'string') {
      this._checkString(schema, data, path);
    }

    // Number validations
    if (typeof data === 'number') {
      this._checkNumber(schema, data, path);
    }

    // Array validations
    if (Array.isArray(data)) {
      this._checkArray(schema, data, path);
    }

    // Object validations
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      this._checkObject(schema, data, path);
    }

    // AllOf, AnyOf, OneOf
    if (schema.allOf) this._checkAllOf(schema, data, path);
    if (schema.anyOf) this._checkAnyOf(schema, data, path);
    if (schema.oneOf) this._checkOneOf(schema, data, path);
    if (schema.not) this._checkNot(schema, data, path);

    // If/Then/Else (draft 7+)
    if (schema.if) this._checkIfThenElse(schema, data, path);
  }

  _checkType(schema, data, path) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = getType(data);

    const matched = types.some(t => {
      if (t === 'integer') return typeof data === 'number' && Number.isInteger(data);
      return t === actualType;
    });

    if (!matched) {
      this._addErr(path, `must be ${types.join(' or ')}, got ${actualType}`, 'type', { expected: types, actual: actualType });
    }
  }

  _checkString(schema, data, path) {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      this._addErr(path, `must be at least ${schema.minLength} characters, got ${data.length}`, 'minLength', { limit: schema.minLength });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      this._addErr(path, `must be at most ${schema.maxLength} characters, got ${data.length}`, 'maxLength', { limit: schema.maxLength });
    }
    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        this._addErr(path, `must match pattern "${schema.pattern}"`, 'pattern', { pattern: schema.pattern });
      }
    }
    if (schema.format !== undefined) {
      const formatResult = checkFormat(schema.format, data);
      if (!formatResult) {
        this._addErr(path, `must match format "${schema.format}", got "${data}"`, 'format', { format: schema.format });
      }
    }
  }

  _checkNumber(schema, data, path) {
    if (schema.minimum !== undefined && data < schema.minimum) {
      this._addErr(path, `must be >= ${schema.minimum}, got ${data}`, 'minimum', { limit: schema.minimum });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      this._addErr(path, `must be <= ${schema.maximum}, got ${data}`, 'maximum', { limit: schema.maximum });
    }
    if (schema.exclusiveMinimum !== undefined) {
      const limit = typeof schema.exclusiveMinimum === 'number' ? schema.exclusiveMinimum : schema.minimum;
      const isDraft4 = typeof schema.exclusiveMinimum === 'boolean';
      if (isDraft4) {
        if (data <= schema.minimum) {
          this._addErr(path, `must be > ${schema.minimum}, got ${data}`, 'exclusiveMinimum', { limit: schema.minimum });
        }
      } else {
        if (data <= schema.exclusiveMinimum) {
          this._addErr(path, `must be > ${schema.exclusiveMinimum}, got ${data}`, 'exclusiveMinimum', { limit: schema.exclusiveMinimum });
        }
      }
    }
    if (schema.exclusiveMaximum !== undefined) {
      if (typeof schema.exclusiveMaximum === 'boolean') {
        if (data >= schema.maximum) {
          this._addErr(path, `must be < ${schema.maximum}, got ${data}`, 'exclusiveMaximum', { limit: schema.maximum });
        }
      } else {
        if (data >= schema.exclusiveMaximum) {
          this._addErr(path, `must be < ${schema.exclusiveMaximum}, got ${data}`, 'exclusiveMaximum', { limit: schema.exclusiveMaximum });
        }
      }
    }
    if (schema.multipleOf !== undefined) {
      if (data % schema.multipleOf !== 0) {
        this._addErr(path, `must be a multiple of ${schema.multipleOf}`, 'multipleOf', { multipleOf: schema.multipleOf });
      }
    }
  }

  _checkArray(schema, data, path) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      this._addErr(path, `must have at least ${schema.minItems} items, got ${data.length}`, 'minItems', { limit: schema.minItems });
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      this._addErr(path, `must have at most ${schema.maxItems} items, got ${data.length}`, 'maxItems', { limit: schema.maxItems });
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      data.forEach((item, i) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          this._addErr(`${path}/${i}`, `duplicate item at index ${i}`, 'uniqueItems', {});
        }
        seen.add(key);
      });
    }

    // Items
    if (schema.items !== undefined) {
      if (Array.isArray(schema.items)) {
        // Tuple validation
        data.forEach((item, i) => {
          if (i < schema.items.length) {
            this._validate(schema.items[i], item, `${path}/${i}`);
          } else if (schema.additionalItems !== undefined) {
            if (schema.additionalItems === false) {
              this._addErr(`${path}/${i}`, `additional items not allowed`, 'additionalItems', {});
            } else if (typeof schema.additionalItems === 'object') {
              this._validate(schema.additionalItems, item, `${path}/${i}`);
            }
          }
        });
      } else {
        // All items same schema
        data.forEach((item, i) => {
          this._validate(schema.items, item, `${path}/${i}`);
        });
      }
    }

    // Contains (draft 6+)
    if (schema.contains !== undefined) {
      const passes = data.some(item => {
        const v = new Validator({ strict: this.strict });
        const result = v.validate(schema.contains, item);
        return result.valid;
      });
      if (!passes && data.length > 0) {
        this._addErr(path, `must contain at least one item matching the schema`, 'contains', {});
      }
    }
  }

  _checkObject(schema, data, path) {
    const keys = Object.keys(data);

    if (schema.required !== undefined) {
      for (const key of schema.required) {
        if (!(key in data)) {
          this._addErr(path, `missing required property "${key}"`, 'required', { missing: key });
        }
      }
    }

    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      this._addErr(path, `must have at least ${schema.minProperties} properties, got ${keys.length}`, 'minProperties', { limit: schema.minProperties });
    }
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
      this._addErr(path, `must have at most ${schema.maxProperties} properties, got ${keys.length}`, 'maxProperties', { limit: schema.maxProperties });
    }

    // Properties
    const definedProps = schema.properties || {};
    const patternProps = schema.patternProperties
      ? Object.entries(schema.patternProperties).map(([p, s]) => [new RegExp(p), s])
      : [];

    const matchedKeys = new Set();

    for (const key of keys) {
      let matched = false;

      // Direct properties
      if (definedProps[key]) {
        this._validate(definedProps[key], data[key], joinPath(path, key));
        matched = true;
      }

      // Pattern properties
      for (const [regex, subSchema] of patternProps) {
        if (regex.test(key)) {
          this._validate(subSchema, data[key], joinPath(path, key));
          matched = true;
        }
      }

      // Additional properties
      if (!matched) {
        if (schema.additionalProperties === false) {
          this._addErr(joinPath(path, key), `additional property "${key}" is not allowed`, 'additionalProperties', { key });
        } else if (typeof schema.additionalProperties === 'object') {
          this._validate(schema.additionalProperties, data[key], joinPath(path, key));
        }
      }
    }

    // Property names (draft 6+)
    if (schema.propertyNames !== undefined) {
      for (const key of keys) {
        const v = new Validator({ strict: this.strict });
        const result = v.validate(schema.propertyNames, key);
        if (!result.valid) {
          this._addErr(joinPath(path, key), `property name "${key}" is invalid`, 'propertyNames', {});
        }
      }
    }

    // Dependencies
    if (schema.dependencies) {
      for (const [key, dep] of Object.entries(schema.dependencies)) {
        if (key in data) {
          if (Array.isArray(dep)) {
            for (const req of dep) {
              if (!(req in data)) {
                this._addErr(path, `property "${key}" requires "${req}"`, 'dependencies', { key, missing: req });
              }
            }
          } else if (typeof dep === 'object') {
            this._validate(dep, data, path);
          }
        }
      }
    }
  }

  _checkAllOf(schema, data, path) {
    for (const sub of schema.allOf) {
      this._validate(sub, data, path);
    }
  }

  _checkAnyOf(schema, data, path) {
    const passes = schema.anyOf.some(sub => {
      const v = new Validator({ strict: this.strict });
      return v.validate(sub, data).valid;
    });
    if (!passes) {
      this._addErr(path, `must match at least one of the schemas in anyOf`, 'anyOf', {});
    }
  }

  _checkOneOf(schema, data, path) {
    let matchCount = 0;
    for (const sub of schema.oneOf) {
      const v = new Validator({ strict: this.strict });
      if (v.validate(sub, data).valid) matchCount++;
    }
    if (matchCount !== 1) {
      this._addErr(path, `must match exactly one schema in oneOf, matched ${matchCount}`, 'oneOf', { matched: matchCount });
    }
  }

  _checkNot(schema, data, path) {
    const v = new Validator({ strict: this.strict });
    if (v.validate(schema.not, data).valid) {
      this._addErr(path, `must not match the "not" schema`, 'not', {});
    }
  }

  _checkIfThenElse(schema, data, path) {
    const v = new Validator({ strict: this.strict });
    const ifValid = v.validate(schema.if, data).valid;

    if (ifValid && schema.then) {
      this._validate(schema.then, data, path);
    } else if (!ifValid && schema.else) {
      this._validate(schema.else, data, path);
    }
  }

  _addErr(path, message, keyword, params) {
    if (this.errors.length < this.maxErrors) {
      this.errors.push({ path, message, keyword, params });
    }
  }
}

// Utility: get JSON type name
function getType(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

// Utility: deep equality
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// Format checkers
const FORMAT_CHECKERS = {
  'date-time': s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s),
  'date': s => /^\d{4}-\d{2}-\d{2}$/.test(s),
  'time': s => /^\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(s),
  'email': s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  'idn-email': s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  'hostname': s => /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(s),
  'idn-hostname': s => /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(s),
  'ipv4': s => /^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every(n => +n >= 0 && +n <= 255),
  'ipv6': s => /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(s) || s === '::1' || /^::$/.test(s),
  'uri': s => /^https?:\/\/.+/.test(s),
  'uri-reference': s => /^(https?:\/\/|\/|\.|\.\.)/.test(s),
  'iri': s => /^https?:\/\/.+/.test(s),
  'uri-template': s => /.+/.test(s), // simplified
  'json-pointer': s => s === '' || s.startsWith('/'),
  'relative-json-pointer': s => /^\d+/.test(s),
  'regex': {
    test: s => { try { new RegExp(s); return true; } catch { return false; } }
  }
};

function checkFormat(format, value) {
  const checker = FORMAT_CHECKERS[format];
  if (!checker) return true; // unknown formats pass
  if (typeof checker === 'function') return checker(value);
  if (checker.test) return checker.test(value);
  return true;
}

module.exports = { Validator };
