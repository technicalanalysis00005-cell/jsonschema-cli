#!/usr/bin/env node

/**
 * json-schema-validator-cli
 * CLI entry point
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { validate, validateFiles, schemaInfo, generateSample } = require('../src/index');
const { c, pluralize, formatPath } = require('../src/utils');

const VERSION = '1.0.0';

function printUsage() {
  console.log(`
${c.bold('jsonschema')} — JSON Schema Validator CLI v${VERSION}

${c.cyan('USAGE:')}

  ${c.bold('validate')}  <schema> <files...>    Validate JSON files against a schema
  ${c.bold('info')}      <schema>                Show schema metadata
  ${c.bold('sample')}    <schema>                Generate sample JSON from schema

${c.cyan('OPTIONS (validate):')}

  --draft <4|6|7|2020-12>   Force schema draft version
  --strict                   Strict mode (no additional properties)
  --verbose                  Show all errors (default: first 10)
  --json                     Output as JSON
  --quiet                    No output, exit code only
  --max-errors <n>           Maximum errors to show (default: 10)

${c.cyan('EXAMPLES:')}

  ${c.dim('$')} jsonschema validate schema.json data.json
  ${c.dim('$')} jsonschema validate schema.json ./configs/ --verbose
  ${c.dim('$')} jsonschema info schema.json
  ${c.dim('$')} jsonschema sample schema.json > example.json

${c.cyan('EXIT CODES:')}

  0   All files valid
  1   One or more files failed validation
  2   Tool error (bad args, missing files, etc.)
`);
}

function parseArgs(argv) {
  const args = {
    command: null,
    schema: null,
    files: [],
    options: {}
  };

  let i = 0;
  // Skip node and script path
  if (argv[0] && argv[0].endsWith('node')) i = 2;
  else if (argv[0] && argv[0].includes('jsonschema')) i = 1;
  else i = 1;

  // Command
  args.command = argv[i] || null;
  i++;

  // Positional args
  const positionals = [];
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (['verbose', 'json', 'quiet', 'strict'].includes(key)) {
        args.options[key] = true;
      } else if (['draft', 'max-errors'].includes(key)) {
        i++;
        args.options[key] = argv[i];
      }
    } else {
      positionals.push(arg);
    }
    i++;
  }

  if (positionals.length > 0) {
    args.schema = positionals[0];
    args.files = positionals.slice(1);
  }

  return args;
}

function collectFiles(inputPaths) {
  const files = [];
  for (const p of inputPaths) {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(p)
          .filter(f => f.endsWith('.json'))
          .map(f => path.join(p, f));
        files.push(...entries);
      } else {
        files.push(p);
      }
    } catch (err) {
      // Try as glob-like pattern
      files.push(p);
    }
  }
  return files;
}

function formatErrors(errors, verbose = false) {
  const maxShow = verbose ? 100 : 10;
  const shown = errors.slice(0, maxShow);

  for (let i = 0; i < shown.length; i++) {
    const e = shown[i];
    const loc = formatPath(e.path);
    const num = c.yellow(`${i + 1}.`);
    console.log(`    ${num} ${c.cyan(loc)} — ${e.message}`);
  }

  if (errors.length > maxShow) {
    console.log(c.dim(`    ... and ${errors.length - maxShow} more errors (use --verbose to see all)`));
  }
}

function runCommand(args) {
  const { command, schema, files, options } = args;

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    console.log(VERSION);
    process.exit(0);
  }

  if (command === 'validate') {
    if (!schema) {
      console.error(c.red('Error: schema file is required'));
      console.error(`  Usage: jsonschema validate <schema> <files...>`);
      process.exit(2);
    }

    if (!fs.existsSync(schema)) {
      console.error(c.red(`Error: schema file not found: ${schema}`));
      process.exit(2);
    }

    let schemaObj;
    try {
      schemaObj = JSON.parse(fs.readFileSync(schema, 'utf-8'));
    } catch (err) {
      console.error(c.red(`Error: invalid JSON in schema: ${err.message}`));
      process.exit(2);
    }

    // Expand directories
    const dataFiles = collectFiles(files.length > 0 ? files : ['.']);

    if (dataFiles.length === 0) {
      console.error(c.red('Error: no JSON files to validate'));
      process.exit(2);
    }

    const validateOpts = {
      strict: options.strict || false,
      maxErrors: parseInt(options['max-errors'] || '10', 10)
    };

    let allValid = true;
    const results = [];

    for (const df of dataFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(df, 'utf-8'));
        const result = validate(schemaObj, data, validateOpts);
        results.push({ file: df, ...result });

        if (!result.valid) allValid = false;
      } catch (err) {
        results.push({
          file: df,
          valid: false,
          errors: [{ path: '#', message: `Parse error: ${err.message}` }]
        });
        allValid = false;
      }
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      process.exit(allValid ? 0 : 1);
    }

    if (options.quiet) {
      process.exit(allValid ? 0 : 1);
    }

    console.log();

    for (const r of results) {
      const name = path.basename(r.file);
      if (r.valid) {
        console.log(`  ${c.green('✔')} ${c.bold(name)} is valid`);
      } else {
        console.log(`  ${c.red('✗')} ${c.bold(name)} is ${c.red('invalid')}`);
        console.log();
        console.log(`    ${c.dim('errors')} (${r.errors.length}):`);
        formatErrors(r.errors, options.verbose);
        console.log();
      }
    }

    if (allValid) {
      console.log();
      console.log(`  ${c.green(`All ${results.length} ${pluralize(results.length, 'file')} valid.`)}`);
    } else {
      const invalidCount = results.filter(r => !r.valid).length;
      console.log();
      console.log(`  ${c.red(`${invalidCount} of ${results.length} ${pluralize(results.length, 'file')} failed validation.`)}`);
    }

    console.log();
    process.exit(allValid ? 0 : 1);
  }

  if (command === 'info') {
    if (!schema) {
      console.error(c.red('Error: schema file is required'));
      process.exit(2);
    }

    if (!fs.existsSync(schema)) {
      console.error(c.red(`Error: file not found: ${schema}`));
      process.exit(2);
    }

    try {
      const info = schemaInfo(schema);

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }

      console.log();
      console.log(`  ${c.bold('Schema Info')}: ${c.cyan(info.file)}`);
      console.log();
      if (info.title) console.log(`  ${c.dim('Title:')}       ${info.title}`);
      if (info.description) console.log(`  ${c.dim('Description:')} ${info.description}`);
      console.log(`  ${c.dim('Draft:')}       ${info.draft}`);
      if (info.type) console.log(`  ${c.dim('Type:')}        ${info.type}`);
      if (info.properties.length > 0) {
        console.log(`  ${c.dim('Properties:')}  ${info.properties.join(', ')}`);
      }
      if (info.required.length > 0) {
        console.log(`  ${c.dim('Required:')}    ${info.required.join(', ')}`);
      }
      if (info.hasDefinitions) {
        console.log(`  ${c.dim('Definitions:')} ${info.defCount}`);
      }
      console.log();
    } catch (err) {
      console.error(c.red(`Error: ${err.message}`));
      process.exit(2);
    }
    return;
  }

  if (command === 'sample') {
    if (!schema) {
      console.error(c.red('Error: schema file is required'));
      process.exit(2);
    }

    if (!fs.existsSync(schema)) {
      console.error(c.red(`Error: file not found: ${schema}`));
      process.exit(2);
    }

    try {
      const schemaObj = JSON.parse(fs.readFileSync(schema, 'utf-8'));
      const sample = generateSample(schemaObj);
      console.log(JSON.stringify(sample, null, 2));
    } catch (err) {
      console.error(c.red(`Error: ${err.message}`));
      process.exit(2);
    }
    return;
  }

  // Unknown command
  console.error(c.red(`Unknown command: ${command}`));
  console.error(`Run ${c.cyan('jsonschema --help')} for usage.`);
  process.exit(2);
}

// Entry
const args = parseArgs(process.argv);
runCommand(args);
