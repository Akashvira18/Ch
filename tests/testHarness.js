/**
 * testHarness.js
 * A deliberately tiny, dependency-free test harness so `node tests/run.js`
 * works with nothing installed (no Jest/Mocha/build step required, matching
 * the "no Node.js requirement for the deployed app" constraint - this
 * harness is a *dev-time* convenience only, not part of the shipped app).
 */

let passed = 0;
let failed = 0;
const failures = [];

export function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  \x1b[31m✗ ${name}\x1b[0m`);
    console.log(`    ${err.message}`);
  }
}

export function describe(label, fn) {
  console.log(`\n${label}`);
  fn();
}

export function assert(condition, message = "Assertion failed") {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

export function assertClose(actual, expected, tolerance = 0.01, message) {
  if (typeof actual !== "number" || !Number.isFinite(actual)) {
    throw new Error(message || `Expected a finite number close to ${expected}, got ${actual}`);
  }
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(message || `Expected ~${expected} (±${tolerance}), got ${actual}`);
  }
}

export function summary() {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}
