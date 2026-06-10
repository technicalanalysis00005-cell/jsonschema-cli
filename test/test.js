const fs = require('fs');
const path = require('path');
const { validateFiles } = require('../lib/validator');

// Test schema
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number", "minimum": 0 },
    "email": { "type": "string", "format": "email" }
  },
  "required": ["name", "age"]
};

// Test data - valid
const validData = {
  name: "John Doe",
  age: 30,
  email: "john@example.com"
};

// Test data - invalid
const invalidData = {
  name: "Jane Doe",
  age: -5,
  email: "not-an-email"
};

// Create test files
const testDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

fs.writeFileSync(path.join(testDir, 'valid.json'), JSON.stringify(validData, null, 2));
fs.writeFileSync(path.join(testDir, 'invalid.json'), JSON.stringify(invalidData, null, 2));
fs.writeFileSync(path.join(testDir, 'schema.json'), JSON.stringify(schema, null, 2));

console.log('Running tests...\n');

// Test validation
(async () => {
  const files = [
    path.join(testDir, 'valid.json'),
    path.join(testDir, 'invalid.json')
  ];

  const results = await validateFiles(files, schema, { verbose: true });

  console.log('\n--- Test Results ---');
  console.log(`Valid file passed: ${results[0].valid ? 'PASS' : 'FAIL'}`);
  console.log(`Invalid file failed: ${!results[1].valid ? 'PASS' : 'FAIL'}`);
  
  // Cleanup
  fs.unlinkSync(path.join(testDir, 'valid.json'));
  fs.unlinkSync(path.join(testDir, 'invalid.json'));
  fs.unlinkSync(path.join(testDir, 'schema.json'));
  fs.rmdirSync(testDir);

  console.log('\nAll tests completed!');
})();
