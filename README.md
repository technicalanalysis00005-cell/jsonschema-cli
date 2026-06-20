# json-schema-validator

A fast, developer-friendly CLI tool for validating JSON files against JSON Schema (Draft 4/6/7/2020-12).

## Features

- **Multiple Draft Support** — JSON Schema Draft 4, 6, 7, and 2020-12
- **Colored Output** — Clear, color-coded terminal output with error locations
- **Batch Validation** — Validate multiple files or entire directories at once
- **Watch Mode** — Re-validate on file changes
- **Exit Codes** — CI/CD friendly exit codes (0 = valid, 1 = invalid, 2 = error)
- **Detailed Error Paths** — Precise JSON Pointer paths to invalid locations
- **Schema Discovery** — Auto-detect `$schema` references in JSON files
- **Zero Config** — Works out of the box with sensible defaults

## Installation

```bash
npm install -g json-schema-validator-cli
```

Or run directly with npx:

```bash
npx json-schema-validator-cli validate schema.json data.json
```

## Usage

### Basic Validation

```bash
# Validate a single file
jsonschema validate schema.json data.json

# Validate multiple files
jsonschema validate schema.json file1.json file2.json file3.json

# Validate all JSON files in a directory
jsonschema validate schema.json ./data/
```

### Options

```
jsonschema validate <schema> <files...> [options]

Options:
  --draft <version>    Force schema draft (4, 6, 7, 2020-12)
  --strict             Enable strict mode (no additional properties)
  --verbose            Show all errors (default: first 10)
  --json               Output errors as JSON
  --quiet              Only show exit code, no output
  --watch              Re-validate on file changes
  --ignore <pattern>   Glob pattern to ignore files
```

### Schema Info

```bash
# Inspect a schema file
jsonschema info schema.json
```

### Generate Sample

```bash
# Generate a sample JSON from a schema
jsonschema sample schema.json
```

## Examples

### Valid file

```
$ jsonschema validate user-schema.json user.json

  ✔ user.json is valid
```

### Invalid file

```
$ jsonschema validate user-schema.json user.json

  ✗ user.json is invalid

    errors (3):
    1. /age — must be >= 0, got -5
    2. /email — must match format "email", got "not-an-email"
    3. /address/zipCode — must be string, got 12345
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | All files valid |
| 1    | One or more files failed validation |
| 2    | Tool error (bad schema, missing files, etc.) |

## Programmatic API

```javascript
const { validate, validateFile } = require('json-schema-validator-cli');

// Validate data against schema
const result = validate(schemaObject, dataObject);
// { valid: true, errors: [] }

// Validate a file on disk
const fileResult = await validateFile('schema.json', 'data.json');
// { valid: false, errors: [{ path: '/name', message: '...' }] }
```

## Schema Formats Supported

- **Draft 4** — Most widely supported, used by many OpenAPI specs
- **Draft 6** — Adds `const`, `contains`, `propertyNames`
- **Draft 7** — Adds `if/then/else`, `$comment`
- **2020-12** — Latest draft with `$dynamicRef`

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Validate JSON configs
  run: npx json-schema-validator-cli validate config-schema.json ./configs/ --quiet
```

## License

MIT
