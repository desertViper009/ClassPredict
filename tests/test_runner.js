/**
 * @file test_runner.js
 * @description Lightweight headless test harness for Gradivue pure numerical & data modules.
 * Designed to execute in Node.js LTS with zero external dependencies.
 */

import { loadFoundationTests } from './test_foundation.js';
import { loadDatasetTests } from './test_csv_parser.js';
import { loadLinearAlgebraTests } from './test_linear_algebra.js';
import { loadRegressionTests } from './test_regression.js';
import { loadInterpolationTests } from './test_interpolation.js';
import { loadValidationTests } from './test_validation.js';
import { loadPredictionTests } from './test_prediction.js';
import { loadOcrTests } from './test_ocr.js';
import { loadDashboardTests } from './test_dashboard.js';
import { loadNumericalLabTests } from './test_numerical_lab.js';
import { loadReleaseHardeningTests } from './test_release_hardening.js';
import { loadUiContractTests } from './test_ui_contract.js';

const suites = [];
let currentSuite = null;

export function describe(suiteName, fn) {
  currentSuite = { name: suiteName, tests: [] };
  suites.push(currentSuite);
  fn();
}

export function it(testName, fn) {
  if (!currentSuite) {
    throw new Error("Test must be declared inside a describe block.");
  }
  currentSuite.tests.push({ name: testName, fn });
}

export function assert(condition, message = "Assertion failed") {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

export function assertFalse(condition, message = "Expected condition to be false") {
  if (condition) {
    throw new Error(message);
  }
}

export function assertClose(actual, expected, tolerance = 1e-9, message) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(message || `Expected ${expected} ± ${tolerance}, but got ${actual} (diff: ${diff})`);
  }
}

export function assertThrows(fn, expectedErrorType, message) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (expectedErrorType && !(err instanceof expectedErrorType) && err.name !== expectedErrorType.name) {
      throw new Error(`Expected error of type ${expectedErrorType.name}, but caught ${err.name}: ${err.message}`);
    }
  }
  if (!threw) {
    throw new Error(message || "Expected function to throw, but it returned normally.");
  }
}

/**
 * Runs all registered test suites and prints formatted execution report.
 */
export async function runAllTests() {
  console.log("===============================================================");
  console.log(" Gradivue — Headless Numerical Verification Test Harness");
  console.log("===============================================================\n");

  const startTime = Date.now();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const suite of suites) {
    console.log(`Suite: ${suite.name}`);
    for (const test of suite.tests) {
      totalTests++;
      try {
        await test.fn();
        console.log(`  ✓ ${test.name}`);
        passedTests++;
      } catch (err) {
        console.log(`  ✗ ${test.name}`);
        console.error(`      Error: ${err.message}`);
        failedTests++;
      }
    }
    console.log("");
  }

  const duration = Date.now() - startTime;
  console.log("---------------------------------------------------------------");
  console.log(`Total Suites: ${suites.length} | Tests: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests} (${duration}ms)`);
  console.log("---------------------------------------------------------------");

  if (failedTests > 0) {
    console.error(`\n❌ VERIFICATION FAILED: ${failedTests} test(s) failed.\n`);
    process.exit(1);
  } else {
    console.log(`\n✅ ALL TESTS PASSED: Numerical & Dataset verification successful.\n`);
    process.exit(0);
  }
}

// Load all suites and run
loadFoundationTests();
loadDatasetTests();
loadLinearAlgebraTests();
loadRegressionTests();
loadInterpolationTests();
loadValidationTests();
loadPredictionTests();
loadOcrTests();
loadDashboardTests();
loadNumericalLabTests();
loadReleaseHardeningTests();
loadUiContractTests();
await runAllTests();
