'use strict';

// CI test runner — no npm packages required, just Node.js built-ins.
//
// All game scripts are concatenated into a single vm context so that
// const/let declarations are visible across files (vm isolates each
// runInContext call, but a single call shares one scope).

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// Build one combined script: game logic + shared tests
const combined = [
  'js/characters.js',
  'js/enemies.js',
  'js/items.js',
  'js/combat.js',
  'js/dungeon.js',
  'tests/tests.js',
]
  .map(function (f) { return '/* ' + f + ' */\n' + read(f); })
  .join('\n\n');

// Provide the globals the game scripts need
const ctx = vm.createContext({
  Math: Math,
  JSON: JSON,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
  Boolean: Boolean,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  isFinite: isFinite,
  console: console,
  process: process,
});

try {
  vm.runInContext(combined, ctx);
} catch (e) {
  console.error('Failed to load game scripts: ' + e.message);
  process.exit(1);
}

// Execute the shared test suite
const results = ctx.runAllTests();

let passed = 0;
let failed = 0;

for (const r of results) {
  if (r.suite) {
    process.stdout.write('\n' + r.suite + '\n');
    continue;
  }
  if (r.ok) {
    process.stdout.write('  ✓ ' + r.name + '\n');
    passed++;
  } else {
    process.stderr.write('  ✗ ' + r.name + '\n');
    if (r.error) process.stderr.write('    → ' + r.error + '\n');
    failed++;
  }
}

const total = passed + failed;
process.stdout.write('\n' + total + ' tests: ' + passed + ' passed, ' + failed + ' failed\n');

if (failed > 0) {
  process.exit(1);
}
