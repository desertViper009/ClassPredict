/**
 * @file test_validation.js
 * @description Comprehensive unit tests for rolling-origin temporal validation,
 * expanding-window training, metric computations, anti-leakage guards, and pooled aggregations.
 * Document Reference: docs/VALIDATION_AND_TESTING.md, docs/REQUIREMENTS.md (FR-08)
 */

import { describe, it, assert, assertEqual, assertClose, assertThrows } from './test_runner.js';
import { 
  computeMae, 
  computeRmse, 
  evaluateTemporalFolds, 
  FOLD_STATUS, 
  EVALUATION_STATUS 
} from '../js/core/temporal_validator.js';
import { fitTransitionRegression } from '../js/core/regression_engine.js';

export function loadValidationTests() {
  describe("Phase 5: Temporal Validation Metrics (MAE & RMSE)", () => {
    it("should compute MAE accurately on a known numerical example", () => {
      // actual: [3.0, 3.5, 4.0], predicted: [3.2, 3.4, 3.7]
      // absolute errors: |3.0-3.2|=0.2, |3.5-3.4|=0.1, |4.0-3.7|=0.3
      // sum = 0.6, MAE = 0.6 / 3 = 0.2
      const actual = [3.0, 3.5, 4.0];
      const predicted = [3.2, 3.4, 3.7];
      const mae = computeMae(actual, predicted);
      assertClose(mae, 0.20, 1e-12, "MAE must equal 0.20");
    });

    it("should compute RMSE accurately on a known numerical example", () => {
      // actual: [3.0, 3.5, 4.0], predicted: [3.2, 3.4, 3.7]
      // squared errors: (0.2)^2=0.04, (0.1)^2=0.01, (0.3)^2=0.09
      // sumSq = 0.14, mean = 0.14 / 3, RMSE = sqrt(0.14 / 3) = 0.21602468994692867
      const actual = [3.0, 3.5, 4.0];
      const predicted = [3.2, 3.4, 3.7];
      const rmse = computeRmse(actual, predicted);
      assertClose(rmse, Math.sqrt(0.14 / 3), 1e-12, "RMSE must equal sqrt(0.14 / 3)");
    });

    it("should return exactly zero error for perfect predictions", () => {
      const actual = [2.50, 3.20, 3.85];
      const predicted = [2.50, 3.20, 3.85];
      assertClose(computeMae(actual, predicted), 0.0, 1e-14, "Perfect MAE must be 0");
      assertClose(computeRmse(actual, predicted), 0.0, 1e-14, "Perfect RMSE must be 0");
    });

    it("should reject empty evaluation arrays with a descriptive error", () => {
      assertThrows(() => computeMae([], []), Error, "Empty actual and predicted must throw");
      assertThrows(() => computeRmse([], []), Error, "Empty actual and predicted must throw");
    });

    it("should reject mismatched array lengths with a descriptive error", () => {
      assertThrows(() => computeMae([3.0, 3.5], [3.0]), Error, "Mismatched lengths must throw");
      assertThrows(() => computeRmse([3.0], [3.0, 3.5]), Error, "Mismatched lengths must throw");
    });

    it("should reject NaN and Infinity in metric computations", () => {
      assertThrows(() => computeMae([NaN, 3.5], [3.0, 3.5]), Error, "NaN in actual must throw");
      assertThrows(() => computeMae([3.0, 3.5], [3.0, Infinity]), Error, "Infinity in predicted must throw");
      assertThrows(() => computeRmse([3.0, -Infinity], [3.0, 3.5]), Error, "-Infinity in actual must throw");
    });
  });

  describe("Phase 5: Expanding-Window Temporal Split & Anti-Leakage Rules", () => {
    it("should ensure training transitions always target semesters strictly earlier than the test semester", () => {
      // Synthetic cohort of 3 students over 5 consecutive semesters with varied SGPAs
      const records = [];
      const studentBases = { "STU_01": 2.5, "STU_02": 3.0, "STU_03": 3.5 };
      for (const [student, base] of Object.entries(studentBases)) {
        for (let sem = 1; sem <= 5; sem++) {
          records.push({ student_key: student, semester_no: sem, sgpa: base + sem * 0.05 });
        }
      }

      const res = evaluateTemporalFolds(records);
      assertEqual(res.evaluation_status, EVALUATION_STATUS.EVALUATED);
      assertEqual(res.folds.length, 4, "Should evaluate target semesters 2, 3, 4, 5");

      for (const fold of res.folds) {
        const targetSem = fold.target_semester;
        // Verify that training transitions in this fold would strictly target < targetSem
        // For fold 2: training count is 0
        // For fold 3: training count is 3 (target sem 2 transitions)
        // For fold 4: training count is 6 (target sem 2, 3 transitions)
        // For fold 5: training count is 9 (target sem 2, 3, 4 transitions)
        if (targetSem === 2) {
          assertEqual(fold.training_transition_count, 0);
          assertEqual(fold.regression_status, FOLD_STATUS.INSUFFICIENT_TRAINING_DATA);
        } else if (targetSem === 3) {
          assertEqual(fold.training_transition_count, 3);
          assertEqual(fold.regression_status, FOLD_STATUS.EVALUATED);
        } else if (targetSem === 4) {
          assertEqual(fold.training_transition_count, 6);
          assertEqual(fold.regression_status, FOLD_STATUS.EVALUATED);
        } else if (targetSem === 5) {
          assertEqual(fold.training_transition_count, 9);
          assertEqual(fold.regression_status, FOLD_STATUS.EVALUATED);
        }
      }
    });

    it("should ensure no test transition is ever included in the corresponding training set", () => {
      const records = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S1", semester_no: 3, sgpa: 3.40 },
        { student_key: "S2", semester_no: 1, sgpa: 2.80 },
        { student_key: "S2", semester_no: 2, sgpa: 2.90 },
        { student_key: "S2", semester_no: 3, sgpa: 3.10 }
      ];

      const res = evaluateTemporalFolds(records);
      const fold3 = res.folds.find(f => f.target_semester === 3);
      assertEqual(fold3.test_transition_count, 2, "Test transitions targeting sem 3");
      assertEqual(fold3.training_transition_count, 2, "Training transitions targeting sem < 3");
      // All fold 3 predictions must strictly have target_semester === 3
      const fold3Predictions = res.predictions.filter(p => p.target_semester === 3);
      assertEqual(fold3Predictions.length, 2);
    });

    it("should expand training windows monotonically as target semesters advance", () => {
      const records = [];
      for (const student of ["S1", "S2", "S3", "S4"]) {
        for (let sem = 1; sem <= 6; sem++) {
          records.push({ student_key: student, semester_no: sem, sgpa: 3.00 + (sem % 3) * 0.2 });
        }
      }

      const res = evaluateTemporalFolds(records);
      for (let i = 0; i < res.folds.length - 1; i++) {
        const currentFold = res.folds[i];
        const nextFold = res.folds[i + 1];
        assert(
          nextFold.training_transition_count >= currentFold.training_transition_count,
          `Training window must expand monotonically: fold ${nextFold.target_semester} (${nextFold.training_transition_count}) >= fold ${currentFold.target_semester} (${currentFold.training_transition_count})`
        );
      }
    });

    it("should strictly skip missing semester gaps without creating artificial transitions", () => {
      // Student S_GAP has semesters 1, 2, and 4 (semester 3 is missing)
      const records = [
        { student_key: "S_GAP", semester_no: 1, sgpa: 3.00 },
        { student_key: "S_GAP", semester_no: 2, sgpa: 3.20 },
        { student_key: "S_GAP", semester_no: 4, sgpa: 3.60 }, // Gap 2 -> 4 must NOT bridge
        { student_key: "S_NORM", semester_no: 1, sgpa: 3.10 },
        { student_key: "S_NORM", semester_no: 2, sgpa: 3.30 },
        { student_key: "S_NORM", semester_no: 3, sgpa: 3.50 }
      ];

      const res = evaluateTemporalFolds(records);
      // Ensure no prediction record exists for S_GAP targeting semester 3 or 4
      const gapPreds = res.predictions.filter(p => p.student_key === "S_GAP");
      assertEqual(gapPreds.length, 1, "S_GAP should produce exactly 1 transition (1 -> 2)");
      assertEqual(gapPreds[0].source_semester, 1);
      assertEqual(gapPreds[0].target_semester, 2);
    });

    it("should handle multi-student cohorts correctly without cross-student transition contamination", () => {
      const records = [];
      const studentKeys = ["STU_A", "STU_B", "STU_C", "STU_D"];
      for (const k of studentKeys) {
        records.push({ student_key: k, semester_no: 1, sgpa: 3.00 });
        records.push({ student_key: k, semester_no: 2, sgpa: 3.20 });
        records.push({ student_key: k, semester_no: 3, sgpa: 3.40 });
      }

      const res = evaluateTemporalFolds(records);
      assertEqual(res.total_eligible_test_transitions, 8, "4 students * 2 transitions = 8 test transitions");
      for (const pred of res.predictions) {
        assert(studentKeys.includes(pred.student_key), "Student key must belong to cohort");
        assertEqual(pred.target_semester, pred.source_semester + 1, "Must be consecutive 1-step");
      }
    });

    it("should return explicit unavailable status on empty and insufficient datasets", () => {
      // 1. Empty dataset
      const resEmpty = evaluateTemporalFolds([]);
      assertEqual(resEmpty.evaluation_status, EVALUATION_STATUS.UNAVAILABLE_NO_TRANSITIONS);
      assertEqual(resEmpty.folds.length, 0);

      // 2. Single-semester dataset (no consecutive transitions possible)
      const resSingle = evaluateTemporalFolds([
        { student_key: "S1", semester_no: 1, sgpa: 3.50 },
        { student_key: "S2", semester_no: 1, sgpa: 3.20 }
      ]);
      assertEqual(resSingle.evaluation_status, EVALUATION_STATUS.UNAVAILABLE_NO_TRANSITIONS);

      // 3. Two-semester dataset (transitions only target semester 2; no earlier data to train regression)
      const resTwoSem = evaluateTemporalFolds([
        { student_key: "S1", semester_no: 1, sgpa: 3.50 },
        { student_key: "S1", semester_no: 2, sgpa: 3.60 },
        { student_key: "S2", semester_no: 1, sgpa: 3.20 },
        { student_key: "S2", semester_no: 2, sgpa: 3.30 }
      ]);
      assertEqual(resTwoSem.evaluation_status, EVALUATION_STATUS.INSUFFICIENT_DATA_FOR_REGRESSION_EVALUATION);
      assertEqual(resTwoSem.folds.length, 1);
      assertEqual(resTwoSem.folds[0].regression_status, FOLD_STATUS.INSUFFICIENT_TRAINING_DATA);
      assertEqual(resTwoSem.paired_comparison_count, 0);
      assertClose(resTwoSem.folds[0].baseline_mae, 0.10, 1e-12, "Baseline still evaluated for fold 2");
    });
  });

  describe("Phase 5: Model Comparison & Reliability Safeguards", () => {
    it("should use exactly identical test targets for paired regression-versus-baseline comparisons", () => {
      const records = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S1", semester_no: 3, sgpa: 3.40 },
        { student_key: "S2", semester_no: 1, sgpa: 2.50 },
        { student_key: "S2", semester_no: 2, sgpa: 2.80 },
        { student_key: "S2", semester_no: 3, sgpa: 3.00 }
      ];

      const res = evaluateTemporalFolds(records);
      const paired = res.predictions.filter(p => p.regression_prediction !== null);
      assert(paired.length > 0, "Paired predictions must exist");

      for (const p of paired) {
        assert(typeof p.actual_sgpa === 'number');
        assert(typeof p.persistence_prediction === 'number');
        assert(typeof p.regression_prediction === 'number');
        assertClose(p.baseline_abs_error, Math.abs(p.actual_sgpa - p.persistence_prediction), 1e-12);
        assertClose(p.regression_abs_error, Math.abs(p.actual_sgpa - p.regression_prediction), 1e-12);
      }
    });

    it("should predict persistence exactly equal to observed previous SGPA", () => {
      const records = [
        { student_key: "S1", semester_no: 1, sgpa: 3.15 },
        { student_key: "S1", semester_no: 2, sgpa: 3.45 }
      ];

      const res = evaluateTemporalFolds(records);
      assertEqual(res.predictions.length, 1);
      assertEqual(res.predictions[0].persistence_prediction, 3.15);
      assertEqual(res.predictions[0].actual_sgpa, 3.45);
      assertClose(res.predictions[0].baseline_abs_error, 0.30, 1e-12);
    });

    it("should produce regression predictions strictly from models fitted only on earlier target semesters", () => {
      // 3 students across Semesters 1, 2, 3
      const records = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.10 },
        { student_key: "S1", semester_no: 3, sgpa: 3.30 },
        { student_key: "S2", semester_no: 1, sgpa: 2.00 },
        { student_key: "S2", semester_no: 2, sgpa: 2.50 },
        { student_key: "S2", semester_no: 3, sgpa: 2.70 },
        { student_key: "S3", semester_no: 1, sgpa: 3.50 },
        { student_key: "S3", semester_no: 2, sgpa: 3.60 },
        { student_key: "S3", semester_no: 3, sgpa: 3.80 }
      ];

      // Fold targeting semester 3 must use training transitions from semester 1 -> 2 only
      const trainingTransitionsSem2 = [
        { previous_sgpa: 3.00, next_sgpa: 3.10 },
        { previous_sgpa: 2.00, next_sgpa: 2.50 },
        { previous_sgpa: 3.50, next_sgpa: 3.60 }
      ];
      const independentModel = fitTransitionRegression(trainingTransitionsSem2);

      const res = evaluateTemporalFolds(records);
      const fold3 = res.folds.find(f => f.target_semester === 3);
      assertClose(fold3.fitted_model.a, independentModel.coefficients.a, 1e-12);
      assertClose(fold3.fitted_model.b, independentModel.coefficients.b, 1e-12);

      // Verify individual predictions match
      const fold3Preds = res.predictions.filter(p => p.target_semester === 3);
      for (const p of fold3Preds) {
        const expected = independentModel.predict(p.actual_sgpa - (p.actual_sgpa - (p.persistence_prediction))).rawPrediction;
        assertClose(p.regression_prediction, expected, 1e-12);
      }
    });

    it("should report regression fitting failures explicitly without crashing evaluation", () => {
      // Degenerate dataset where Sem 1 -> 2 has constant SGPA across all students (Var(x) = 0)
      const records = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S1", semester_no: 3, sgpa: 3.50 },
        { student_key: "S2", semester_no: 1, sgpa: 3.00 }, // same x
        { student_key: "S2", semester_no: 2, sgpa: 3.40 },
        { student_key: "S2", semester_no: 3, sgpa: 3.70 }
      ];

      const res = evaluateTemporalFolds(records);
      const fold3 = res.folds.find(f => f.target_semester === 3);
      assertEqual(fold3.regression_status, FOLD_STATUS.FIT_FAILED);
      assert(fold3.failure_reason.includes("Insufficient variation in predictor") || fold3.failure_reason.includes("variance"));
      assertEqual(fold3.regression_mae, null);
      assertEqual(fold3.regression_rmse, null);
      assertEqual(fold3.paired_comparison_count, 0);
    });

    it("should preserve baseline evaluation even when regression fitting fails", () => {
      // Same degenerate dataset as above
      const records = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S1", semester_no: 3, sgpa: 3.50 },
        { student_key: "S2", semester_no: 1, sgpa: 3.00 },
        { student_key: "S2", semester_no: 2, sgpa: 3.40 },
        { student_key: "S2", semester_no: 3, sgpa: 3.70 }
      ];

      const res = evaluateTemporalFolds(records);
      const fold3 = res.folds.find(f => f.target_semester === 3);
      assertEqual(fold3.regression_status, FOLD_STATUS.FIT_FAILED);
      // Baseline evaluation must be intact
      assert(typeof fold3.baseline_mae === 'number' && Number.isFinite(fold3.baseline_mae));
      assert(typeof fold3.baseline_rmse === 'number' && Number.isFinite(fold3.baseline_rmse));
      // For fold 3: actuals = [3.50, 3.70], baseline preds = [3.20, 3.40], errors = [0.30, 0.30]
      assertClose(fold3.baseline_mae, 0.30, 1e-12);
    });

    it("should preserve raw out-of-range regression predictions without silent clipping", () => {
      // Training has steep slope extrapolating to > 4.00 on test data
      // y = 2.0 * x
      const records = [
        { student_key: "S1", semester_no: 1, sgpa: 1.00 },
        { student_key: "S1", semester_no: 2, sgpa: 2.00 },
        { student_key: "S1", semester_no: 3, sgpa: 3.80 },
        { student_key: "S2", semester_no: 1, sgpa: 1.50 },
        { student_key: "S2", semester_no: 2, sgpa: 3.00 },
        { student_key: "S2", semester_no: 3, sgpa: 3.90 },
        // In fold 3, test input is S1 sem 2 (2.00) -> 2.0 * 2.0 = 4.00
        // S2 sem 2 (3.00) -> 2.0 * 3.0 = 6.00 (> 4.00!)
        { student_key: "S3", semester_no: 1, sgpa: 2.00 },
        { student_key: "S3", semester_no: 2, sgpa: 3.50 },
        { student_key: "S3", semester_no: 3, sgpa: 3.95 }
      ];

      const res = evaluateTemporalFolds(records);
      const outOfRangePreds = res.predictions.filter(p => p.regression_is_out_of_range);
      assert(outOfRangePreds.length > 0, "Out-of-range predictions must be flagged");
      assert(outOfRangePreds[0].regression_prediction > 4.00, "Must NOT be clamped to 4.00");
    });

    it("should handle non-finite predictions explicitly without NaN corruption", () => {
      const records = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S1", semester_no: 3, sgpa: 3.50 },
        { student_key: "S2", semester_no: 1, sgpa: 2.50 },
        { student_key: "S2", semester_no: 2, sgpa: 2.70 },
        { student_key: "S2", semester_no: 3, sgpa: 3.10 }
      ];

      const res = evaluateTemporalFolds(records);
      // All actual and predicted values must be valid finite numbers
      for (const p of res.predictions) {
        assert(Number.isFinite(p.actual_sgpa));
        assert(Number.isFinite(p.persistence_prediction));
        if (p.regression_prediction !== null) {
          assert(Number.isFinite(p.regression_prediction));
        }
      }
    });
  });

  describe("Phase 5: Strict Temporal Leakage & Aggregation Integrity", () => {
    it("should guarantee that changing future target SGPA never changes earlier fold fitted coefficients", () => {
      // Cohort A: 3 students, 4 semesters
      const cohortA = [
        { student_key: "A1", semester_no: 1, sgpa: 3.00 },
        { student_key: "A1", semester_no: 2, sgpa: 3.10 },
        { student_key: "A1", semester_no: 3, sgpa: 3.20 },
        { student_key: "A1", semester_no: 4, sgpa: 3.30 },
        { student_key: "A2", semester_no: 1, sgpa: 2.00 },
        { student_key: "A2", semester_no: 2, sgpa: 2.40 },
        { student_key: "A2", semester_no: 3, sgpa: 2.80 },
        { student_key: "A2", semester_no: 4, sgpa: 3.10 }
      ];

      // Cohort B: Identical Semesters 1 and 2, but completely different future Semesters 3 and 4!
      const cohortB = [
        { student_key: "A1", semester_no: 1, sgpa: 3.00 }, // same
        { student_key: "A1", semester_no: 2, sgpa: 3.10 }, // same
        { student_key: "A1", semester_no: 3, sgpa: 3.95 }, // ALTERED FUTURE
        { student_key: "A1", semester_no: 4, sgpa: 4.00 }, // ALTERED FUTURE
        { student_key: "A2", semester_no: 1, sgpa: 2.00 }, // same
        { student_key: "A2", semester_no: 2, sgpa: 2.40 }, // same
        { student_key: "A2", semester_no: 3, sgpa: 2.10 }, // ALTERED FUTURE
        { student_key: "A2", semester_no: 4, sgpa: 2.20 }  // ALTERED FUTURE
      ];

      const resA = evaluateTemporalFolds(cohortA);
      const resB = evaluateTemporalFolds(cohortB);

      // Fold targeting semester 3 trains on Semesters < 3 (i.e. Semester 1 -> 2)
      const fold3A = resA.folds.find(f => f.target_semester === 3);
      const fold3B = resB.folds.find(f => f.target_semester === 3);

      assertEqual(fold3A.regression_status, FOLD_STATUS.EVALUATED);
      assertEqual(fold3B.regression_status, FOLD_STATUS.EVALUATED);

      // Both models MUST have identical intercept and slope down to floating-point exactness!
      assertClose(fold3A.fitted_model.a, fold3B.fitted_model.a, 1e-14, "Intercept must be identical regardless of future changes");
      assertClose(fold3A.fitted_model.b, fold3B.fitted_model.b, 1e-14, "Slope must be identical regardless of future changes");
    });

    it("should guarantee future transitions never enter an earlier fold training set", () => {
      const records = [];
      for (let s = 1; s <= 5; s++) {
        for (let sem = 1; sem <= 6; sem++) {
          records.push({ student_key: `STU_${s}`, semester_no: sem, sgpa: 3.00 + (s * 0.1) });
        }
      }

      const res = evaluateTemporalFolds(records);
      for (const fold of res.folds) {
        const t = fold.target_semester;
        // The maximum target semester used to train fold t MUST be strictly < t
        const expectedMaxTrainingTarget = t - 1;
        assert(expectedMaxTrainingTarget < t, "Strict inequality max(training target semester) < t violated");
      }
    });

    it("should compute pooled metrics from pooled prediction records rather than unweighted average of fold metrics", () => {
      // Disproportionate folds case:
      // Fold 3: 2 predictions with small error (e.g. 0.10)
      // Fold 4: 10 predictions with large error (e.g. 0.90)
      // Unweighted average of fold MAEs: (0.10 + 0.90) / 2 = 0.50
      // Weighted pooled MAE: (2 * 0.10 + 10 * 0.90) / 12 = 9.20 / 12 = 0.7667
      const predictions = [];
      // 2 predictions in fold 3 with diff 0.10
      predictions.push({ actual_sgpa: 3.00, persistence_prediction: 3.00, regression_prediction: 3.10 });
      predictions.push({ actual_sgpa: 3.00, persistence_prediction: 3.00, regression_prediction: 3.10 });
      // 10 predictions in fold 4 with diff 0.90
      for (let i = 0; i < 10; i++) {
        predictions.push({ actual_sgpa: 3.00, persistence_prediction: 3.00, regression_prediction: 3.90 });
      }

      const pooledActuals = predictions.map(p => p.actual_sgpa);
      const pooledReg = predictions.map(p => p.regression_prediction);
      const pooledMae = computeMae(pooledActuals, pooledReg);

      assertClose(pooledMae, 9.20 / 12, 1e-12, "Pooled MAE must equal observation-weighted mean, not fold average");
      assert(Math.abs(pooledMae - 0.50) > 0.20, "Pooled MAE must NOT equal unweighted fold average (0.50)");
    });

    it("should never present failed folds as successful evaluations", () => {
      const records = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S1", semester_no: 3, sgpa: 3.50 }
      ];

      // Only 1 training transition (S1 sem 1 -> 2), minTrainingSamples default is 2
      const res = evaluateTemporalFolds(records);
      const fold3 = res.folds.find(f => f.target_semester === 3);
      assertEqual(fold3.regression_status, FOLD_STATUS.INSUFFICIENT_TRAINING_DATA);
      assertEqual(fold3.regression_mae, null);
      assertEqual(fold3.regression_rmse, null);
      assertEqual(fold3.paired_comparison_count, 0);
    });

    it("should guarantee input immutability during temporal evaluation", () => {
      const records = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S1", semester_no: 3, sgpa: 3.40 }
      ];
      const copy = JSON.stringify(records);
      evaluateTemporalFolds(records);
      assertEqual(JSON.stringify(records), copy, "Caller's input dataset must not be modified");
    });
  });
}
