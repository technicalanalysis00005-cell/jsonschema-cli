# JSON Schema Validator CLI

A lightweight command-line tool for validating JSON files against JSON Schema specifications. Built with Node.js and the AJV validator library.

## Features

- ✅ Validate JSON files against JSON Schema (Draft 7, 2019-09, 2020-12)
- 📂 Batch validation of multiple JSON files
- 🎨 Colorful, detailed error reporting
- 🚀 Fast validation using AJV
- 📊 Summary statistics for batch operations

## Installation

```bash
npm install -g json-schema-validator-cli
```

Or use locally:

```bash
npm install
npm link
```

## Usage

### Validate a single file

```bash
jsv validate data.json --schema schema.json
```

### Validate multiple files

```bash
jsv validate *.json --schema schema.json
```

### Options

- `--schema, -s` - Path to JSON Schema file (required)
- `--strict` - Enable strict mode validation
- `--verbose, -v` - Show detailed validation results

## Examples

```bash
# Validate a user profile
jsv validate user.json -s user-schema.json

# Batch validate all config files
jsv validate configs/*.json -s config-schema.json --verbose

# Strict mode validation
jsv validate data.json -s schema.json --strict
```

## JSON Schema Example

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number", "minimum": 0 }
  },
  "required": ["name"]
}
```

## License

MIT
