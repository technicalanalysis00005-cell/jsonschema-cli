const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

/**
 * Validate multiple JSON files against a schema
 * @param {string[]} files - Array of file paths
 * @param {object} schema - JSON Schema object
 * @param {object} options - Validation options
 * @returns {Promise<Array>} Validation results
 */
async function validateFiles(files, schema, options = {}) {
  const ajv = new Ajv({
    allErrors: true,
    strict: options.strict || false,
    verbose: options.verbose || false
  });
  
  addFormats(ajv);
  
  const validate = ajv.compile(schema);
  const results = [];

  for (const file of files) {
    const result = await validateFile(file, validate, options);
    results.push(result);
  }

  return results;
}

/**
 * Validate a single JSON file
 * @param {string} filePath - Path to JSON file
 * @param {Function} validate - Compiled AJV validator
 * @param {object} options - Validation options
 * @returns {Promise<object>} Validation result
 */
async function validateFile(filePath, validate, options) {
  const absolutePath = path.resolve(filePath);

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    console.error(chalk.red(`✗ File not found: ${filePath}`));
    return {
      file: filePath,
      valid: false,
      errors: [{ message: 'File not found' }]
    };
  }

  try {
    // Read and parse JSON
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const data = JSON.parse(content);

    // Validate against schema
    const valid = validate(data);

    if (valid) {
      console.log(chalk.green(`✓ ${filePath}`));
      if (options.verbose) {
        console.log(chalk.gray('  All validation rules passed'));
      }
      return {
        file: filePath,
        valid: true,
        errors: null
      };
    } else {
      console.log(chalk.red(`✗ ${filePath}`));
      
      // Display errors
      if (validate.errors) {
        validate.errors.forEach(error => {
          const location = error.instancePath || '/';
          console.log(chalk.yellow(`  ${location}: ${error.message}`));
          if (options.verbose && error.params) {
            console.log(chalk.gray(`    ${JSON.stringify(error.params)}`));
          }
        });
      }

      return {
        file: filePath,
        valid: false,
        errors: validate.errors
      };
    }

  } catch (error) {
    console.error(chalk.red(`✗ ${filePath}`));
    console.error(chalk.yellow(`  Error: ${error.message}`));
    
    return {
      file: filePath,
      valid: false,
      errors: [{ message: error.message }]
    };
  }
}

module.exports = {
  validateFiles,
  validateFile
};
