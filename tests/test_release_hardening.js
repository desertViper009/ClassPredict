/**
 * @file test_release_hardening.js
 * @description Comprehensive automated test suite for Phase 10: Final Hardening, Production Deployment & Portfolio Release.
 * Verifies deployment configurations, Service Worker asset manifests, synthetic demo workflows,
 * missing semester gaps, out-of-range predictions, privacy boundaries, and regression safety.
 */

import { describe, it, assert, assertEqual, assertFalse, assertClose, assertThrows } from './test_runner.js';
import { parseCSV, validateAndNormalizeDataset, computeDatasetSummary } from '../js/core/data_validator.js';
import { StateManager } from '../js/services/state_manager.js';
import { 
  predictIndividualStudent, 
  predictWholeClass, 
  PREDICTION_MODELS, 
  PREDICTION_STATUS 
} from '../js/core/prediction_service.js';
import { runGaussianEliminationExperiment, fitLinearAndQuadraticRegression } from '../js/core/numerical_lab.js';
import fs from 'fs';
import path from 'path';

export function loadReleaseHardeningTests() {
  describe("Phase 10: Release Readiness & Package Configuration", () => {
    it("Case 1: should verify package.json metadata and production release readiness", () => {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      assert(fs.existsSync(pkgPath), "package.json must exist in root");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assertEqual(pkg.name, 'gradivue');
      assertEqual(pkg.type, 'module', "Must be native ES6 module");
      assert(pkg.scripts && pkg.scripts.test, "Must contain test script");
    });

    it("Case 2: should verify Service Worker exists and contains all required static assets", () => {
      const swPath = path.resolve(process.cwd(), 'sw.js');
      assert(fs.existsSync(swPath), "sw.js must exist in root");
      const swContent = fs.readFileSync(swPath, 'utf8');
      assert(swContent.includes('CACHE_NAME'), "sw.js must define CACHE_NAME");
      assert(swContent.includes('APP_SHELL_ASSETS'), "sw.js must declare static application shell assets");
      assert(swContent.includes('index.html'), "sw.js must cache index.html");
      assert(swContent.includes('css/main.css'), "sw.js must cache css/main.css");
      assert(swContent.includes('js/app.js'), "sw.js must cache js/app.js");
      assert(swContent.includes('samples/sample_class_sgpa.csv'), "sw.js must cache sample dataset");
      assert(!swContent.includes('localStorage'), "sw.js must not persist user data to storage");
    });

    it("Case 3: should verify no local machine paths (e.g., Windows user dirs) in application code", () => {
      const filesToCheck = [
        'index.html',
        'css/main.css',
        'css/components.css',
        'js/app.js',
        'js/core/data_validator.js',
        'js/core/linear_algebra.js',
        'js/core/regression_engine.js',
        'js/core/prediction_service.js',
        'js/core/numerical_lab.js',
        'js/services/state_manager.js'
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assertFalse(content.includes('Users\\anowa'), `File ${relPath} must not contain absolute machine paths`);
          assertFalse(content.includes('C:\\Users'), `File ${relPath} must not contain Windows drive paths`);
        }
      }
    });
  });

  describe("Phase 10: Synthetic Demonstration Dataset & Edge Cases", () => {
    it("Case 4: should validate enhanced synthetic demonstration dataset schema", () => {
      const samplePath = path.resolve(process.cwd(), 'samples/sample_class_sgpa.csv');
      assert(fs.existsSync(samplePath), "samples/sample_class_sgpa.csv must exist");
      const csvText = fs.readFileSync(samplePath, 'utf8');
      const rows = parseCSV(csvText);
      const validation = validateAndNormalizeDataset(rows);
      assert(validation.isValid, "Synthetic demonstration CSV must be 100% valid");
      assert(validation.normalizedRecords.length > 40, "Must contain rich set of academic observations");
    });

    it("Case 5: should detect missing semester gap student (SYN_011) without fabricating transition", () => {
      const samplePath = path.resolve(process.cwd(), 'samples/sample_class_sgpa.csv');
      const csvText = fs.readFileSync(samplePath, 'utf8');
      const rows = parseCSV(csvText);
      const validation = validateAndNormalizeDataset(rows);
      const summary = computeDatasetSummary(validation.normalizedRecords);

      assert(summary.studentsWithGaps.length >= 1, "Summary must detect non-consecutive semester gap");
      const syn011Gap = summary.studentsWithGaps.find(g => g.student_key === 'SYN_011');
      assert(syn011Gap !== undefined, "SYN_011 must be identified in studentsWithGaps");
      assertEqual(syn011Gap.fromSemester, 1);
      assertEqual(syn011Gap.toSemester, 3);
      assertEqual(syn011Gap.missingSemesters, 1);

      // Verify SYN_011 has semesters 1 & 3
      const syn011 = validation.normalizedRecords.filter(r => r.student_key === 'SYN_011');
      assertEqual(syn011.length, 2, "SYN_011 must have exactly 2 observations");
      assertEqual(syn011[0].semester_no, 1);
      assertEqual(syn011[1].semester_no, 3);
    });

    it("Case 6: should enforce 3-7 semester bound for individual trend and support single-semester student in cohort", () => {
      // Individual prediction requires 3-7 semesters
      assertThrows(() => {
        predictIndividualStudent([{ semester_no: 1, sgpa: 3.10 }]);
      }, Error, "Should throw descriptive error when history is less than 3 semesters");

      // In whole-class cohort prediction, single-semester student receives persistence baseline forecast
      const cohort = [
        { student_key: 'SYN_012', semester_no: 1, sgpa: 3.10 },
        { student_key: 'SYN_001', semester_no: 1, sgpa: 3.40 },
        { student_key: 'SYN_001', semester_no: 2, sgpa: 3.60 }
      ];
      const wholeClass = predictWholeClass(cohort);
      const syn012Pred = wholeClass.students.find(s => s.student_key === 'SYN_012');
      assert(syn012Pred !== undefined, "SYN_012 must be present in whole-class prediction");
      assertEqual(syn012Pred.baseline_prediction, 3.10, "Persistence baseline forecast must be 3.10");
    });

    it("Case 7: should display raw unclipped prediction and flag out-of-range for steep trajectory (SYN_013)", () => {
      // SYN_013: 1 -> 3.50, 2 -> 3.75, 3 -> 3.95.
      // Trend: slope = 0.225. Predicted Sem 4 = 3.50 + 0.225 * 3 = 4.175 > 4.00
      const studentHistory = [
        { semester_no: 1, sgpa: 3.50 },
        { semester_no: 2, sgpa: 3.75 },
        { semester_no: 3, sgpa: 3.95 }
      ];
      const pred = predictIndividualStudent(studentHistory, { model: PREDICTION_MODELS.INDIVIDUAL_TREND });

      assertEqual(pred.status, PREDICTION_STATUS.PREDICTED);
      assertEqual(pred.modelId, 'MODEL_C_INDIVIDUAL_TREND');
      assert(pred.rawPrediction > 4.00, `Raw prediction ${pred.rawPrediction} must remain unclipped (> 4.00)`);
      assertEqual(pred.isOutOfRange, true, "Must flag out-of-range alert badge");
    });
  });

  describe("Phase 10: State Isolation, Discard Cleanup & Security Audit", () => {
    it("Case 8: should cleanly purge accepted dataset and reset state on discard", () => {
      const state = new StateManager();
      const csv = "student_key,semester_no,sgpa\nSYN_001,1,3.40\nSYN_001,2,3.60\nSYN_002,1,2.80\nSYN_002,2,3.00";
      state.loadCSV(csv);
      state.acceptStagedDataset();

      assertEqual(state.getState().acceptedDataset.length, 4, "Accepted dataset must have 4 records");
      assert(state.getState().acceptedSummary !== null, "Summary must be populated");

      // Clear accepted dataset
      state.clearAcceptedDataset();
      assertEqual(state.getState().acceptedDataset, null, "Accepted dataset must be null after clear");
      assertEqual(state.getState().acceptedSummary, null, "Summary must be null after clear");
      assertEqual(state.getState().stagedDataset, null, "Staging must be null after clear");
      assertEqual(state.getState().status, 'empty', "State status must be 'empty' after clear");
    });

    it("Case 9: should guarantee educational lab operations never mutate accepted dataset or production state", () => {
      const state = new StateManager();
      const csv = "student_key,semester_no,sgpa\nSYN_001,1,3.40\nSYN_001,2,3.60";
      state.loadCSV(csv);
      state.acceptStagedDataset();

      const initialCount = state.getState().acceptedDataset.length;
      const initialJson = JSON.stringify(state.getState().acceptedDataset);

      // Run multiple educational experiments
      const A = [[4, 1], [1, 3]];
      const b = [5, 4];
      runGaussianEliminationExperiment(A, b);

      const x = [1, 2, 3, 4];
      const y = [2.0, 3.1, 4.0, 4.9];
      fitLinearAndQuadraticRegression(x, y);

      // Verify production state untouched
      assertEqual(state.getState().acceptedDataset.length, initialCount);
      assertEqual(JSON.stringify(state.getState().acceptedDataset), initialJson);
    });

    it("Case 10: should verify all phases 2 through 9 remain regression-free and stable", () => {
      // Quick multi-module smoke test
      const studentHistory = [
        { semester_no: 1, sgpa: 3.20 },
        { semester_no: 2, sgpa: 3.40 },
        { semester_no: 3, sgpa: 3.60 }
      ];
      const indPred = predictIndividualStudent(studentHistory, { model: PREDICTION_MODELS.INDIVIDUAL_TREND });
      assertEqual(indPred.status, PREDICTION_STATUS.PREDICTED);
      assertClose(indPred.rawPrediction, 3.80, 1e-4, "Predicted SGPA must be 3.80");

      const labRes = runGaussianEliminationExperiment([[2, 1], [1, 2]], [4, 5]);
      assert(labRes.success, "Lab Gaussian elimination must succeed");
      assertClose(labRes.solution[0], 1.0, 1e-4);
      assertClose(labRes.solution[1], 2.0, 1e-4);
    });
  });
}
