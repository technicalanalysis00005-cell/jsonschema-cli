#!/usr/bin/env node

const { program } = require('commander');
const { validateFiles } = require('../lib/validator');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

program
  .name('jsv')
  .description('JSON Schema Validator CLI')
  .version('1.0.0');

program
  .command('validate')
  .description('Validate JSON file(s) against a JSON Schema')
  .argument('<files...>', 'JSON files to validate')
  .requiredOption('-s, --schema <path>', 'Path to JSON Schema file')
  .option('--strict', 'Enable strict mode validation')
  .option('-v, --verbose', 'Show detailed validation results')
  .action(async (files, options) => {
    try {
      // Check if schema file exists
      if (!fs.existsSync(options.schema)) {
        console.error(chalk.red(`✗ Schema file not found: ${options.schema}`));
        process.exit(1);
      }

      // Load schema
      const schemaPath = path.resolve(options.schema);
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

      // Validate files
      const results = await validateFiles(files, schema, options);

      // Display results
      let totalFiles = results.length;
      let validFiles = results.filter(r => r.valid).length;
      let invalidFiles = totalFiles - validFiles;

      console.log('\n' + chalk.bold('Validation Summary:'));
      console.log(chalk.green(`✓ Valid: ${validFiles}`));
      console.log(chalk.red(`✗ Invalid: ${invalidFiles}`));
      console.log(chalk.gray(`Total: ${totalFiles}`));

      // Exit with error code if any validation failed
      if (invalidFiles > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
