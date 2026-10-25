/**
 * @file test_regression.js
 * @description Unit tests for transition construction, persistence baseline, and linear least-squares regression.
 * Document Reference: docs/VALIDATION_AND_TESTING.md (TC-NUM-04, TC-NUM-05, TC-EDG-02)
 */

import { describe, it, assert, assertEqual, assertClose, assertThrows } from './test_runner.js';
import { 
  buildConsecutiveTransitions, 
  predictPersistence, 
  fitLinearRegression, 
  fitTransitionRegression 
} from '../js/core/regression_engine.js';

export function loadRegressionTests() {
  describe("Phase 4: Consecutive Transition Construction", () => {
    it("should construct valid one-step transitions for a single student", () => {
      const records = [
        { student_key: "STU_001", semester_no: 1, sgpa: 3.20 },
        { student_key: "STU_001", semester_no: 2, sgpa: 3.40 },
        { student_key: "STU_001", semester_no: 3, sgpa: 3.55 }
      ];
      const res = buildConsecutiveTransitions(records);
      assertEqual(res.totalTransitions, 2);
      assertEqual(res.studentCount, 1);
      assertEqual(res.skippedGapsCount, 0);

      const t0 = res.transitions[0];
      assertEqual(t0.student_key, "STU_001");
      assertEqual(t0.from_semester, 1);
      assertEqual(t0.to_semester, 2);
      assertClose(t0.previous_sgpa, 3.20, 1e-12);
      assertClose(t0.next_sgpa, 3.40, 1e-12);

      const t1 = res.transitions[1];
      assertEqual(t1.from_semester, 2);
      assertEqual(t1.to_semester, 3);
      assertClose(t1.previous_sgpa, 3.40, 1e-12);
      assertClose(t1.next_sgpa, 3.55, 1e-12);
    });

    it("should handle multiple students without mixing records between students", () => {
      const records = [
        { student_key: "STU_A", semester_no: 1, sgpa: 3.00 },
        { student_key: "STU_A", semester_no: 2, sgpa: 3.20 },
        { student_key: "STU_B", semester_no: 1, sgpa: 3.50 },
        { student_key: "STU_B", semester_no: 2, sgpa: 3.70 }
      ];
      const res = buildConsecutiveTransitions(records);
      assertEqual(res.totalTransitions, 2);
      assertEqual(res.studentCount, 2);

      // Verify STU_A transition
      const tA = res.transitions.find(t => t.student_key === "STU_A");
      assertEqual(tA.previous_sgpa, 3.00);
      assertEqual(tA.next_sgpa, 3.20);

      // Verify STU_B transition
      const tB = res.transitions.find(t => t.student_key === "STU_B");
      assertEqual(tB.previous_sgpa, 3.50);
      assertEqual(tB.next_sgpa, 3.70);
    });

    it("should strictly exclude missing semester gaps without bridging or inventing data", () => {
      // Semesters 1, 2, 4 -> 1->2 is valid, 2->4 is a gap of 2 (invalid)
      const records = [
        { student_key: "STU_GAP", semester_no: 1, sgpa: 3.10 },
        { student_key: "STU_GAP", semester_no: 2, sgpa: 3.25 },
        { student_key: "STU_GAP", semester_no: 4, sgpa: 3.40 }
      ];
      const res = buildConsecutiveTransitions(records);
      assertEqual(res.totalTransitions, 1, "Only 1 valid transition must be formed (1 -> 2)");
      assertEqual(res.skippedGapsCount, 1, "One gap transition (2 -> 4) must be skipped");
      assertEqual(res.transitions[0].from_semester, 1);
      assertEqual(res.transitions[0].to_semester, 2);
    });

    it("should reject duplicate student-semester entries in transition construction", () => {
      const records = [
        { student_key: "STU_DUP", semester_no: 1, sgpa: 3.20 },
        { student_key: "STU_DUP", semester_no: 1, sgpa: 3.50 }
      ];
      assertThrows(() => buildConsecutiveTransitions(records), Error, "Duplicate entries must be rejected");
    });

    it("should sort transitions deterministically by student_key ASC and from_semester ASC", () => {
      // Unsorted input across students and semesters
      const records = [
        { student_key: "STU_Z", semester_no: 2, sgpa: 3.50 },
        { student_key: "STU_A", semester_no: 2, sgpa: 3.20 },
        { student_key: "STU_Z", semester_no: 1, sgpa: 3.40 },
        { student_key: "STU_A", semester_no: 3, sgpa: 3.60 },
        { student_key: "STU_A", semester_no: 1, sgpa: 3.00 }
      ];
      const res = buildConsecutiveTransitions(records);
      assertEqual(res.transitions.length, 3, "Expected 3 total transitions");
      assertEqual(res.transitions[0].student_key, "STU_A");
      assertEqual(res.transitions[0].from_semester, 1);
      assertEqual(res.transitions[0].to_semester, 2);
      assertEqual(res.transitions[1].student_key, "STU_A");
      assertEqual(res.transitions[1].from_semester, 2);
      assertEqual(res.transitions[1].to_semester, 3);
      assertEqual(res.transitions[2].student_key, "STU_Z");
      assertEqual(res.transitions[2].from_semester, 1);
      assertEqual(res.transitions[2].to_semester, 2);
    });

    it("should guarantee input immutability during transition construction", () => {
      const records = [
        { student_key: "STU_IMMUTABLE", semester_no: 2, sgpa: 3.40 },
        { student_key: "STU_IMMUTABLE", semester_no: 1, sgpa: 3.20 }
      ];
      const copy = JSON.stringify(records);
      buildConsecutiveTransitions(records);
      assertEqual(JSON.stringify(records), copy, "Caller's records array must not be mutated");
    });
  });

  describe("Phase 4: Persistence Baseline Predictor", () => {
    it("should predict next SGPA exactly equal to latest observed SGPA", () => {
      const res = predictPersistence(3.45);
      assertEqual(res.modelId, "MODEL_A_PERSISTENCE");
      assertEqual(res.previousSgpa, 3.45);
      assertEqual(res.rawPrediction, 3.45);
      assertEqual(res.isOutOfRange, false);
    });

    it("should flag out-of-range inputs without silently clipping", () => {
      const res = predictPersistence(4.25, { scaleMax: 4.00 });
      assertEqual(res.rawPrediction, 4.25, "Must preserve raw value");
      assertEqual(res.isOutOfRange, true, "Must flag out of range");

      const resNegative = predictPersistence(-0.10);
      assertEqual(resNegative.rawPrediction, -0.10);
      assertEqual(resNegative.isOutOfRange, true);
    });

    it("should throw an error on non-finite or non-numeric persistence inputs", () => {
      assertThrows(() => predictPersistence(NaN), Error, "NaN must throw");
      assertThrows(() => predictPersistence(Infinity), Error, "Infinity must throw");
      assertThrows(() => predictPersistence("3.50"), Error, "String must throw");
    });
  });

  describe("Phase 4: Linear Least-Squares Regression", () => {
    it("should fit an exact straight line dataset accurately", () => {
      // y = 0.5 * x + 1.5
      // Points: (1.0, 2.0), (2.0, 2.5), (3.0, 3.0), (4.0, 3.5)
      const x = [1.0, 2.0, 3.0, 4.0];
      const y = [2.0, 2.5, 3.0, 3.5];

      const model = fitLinearRegression(x, y);
      assertClose(model.coefficients.b, 0.5, 1e-12, "Slope b must equal 0.5");
      assertClose(model.coefficients.a, 1.5, 1e-12, "Intercept a must equal 1.5");
      assertEqual(model.sampleCount, 4);

      // Prediction at x = 3.0 -> y = 0.5*3 + 1.5 = 3.0
      const pred = model.predict(3.0);
      assertClose(pred.rawPrediction, 3.0, 1e-12);
      assertEqual(pred.isOutOfRange, false);
    });

    it("should correctly convert coefficients back from centered coordinate system", () => {
      // y = 0.8 * x + 0.4
      // Predictor mean is 3.0. Centered x' = [-1, 0, 1].
      const x = [2.0, 3.0, 4.0];
      const y = [2.0, 2.8, 3.6]; // 0.8*2 + 0.4 = 2.0; 0.8*3 + 0.4 = 2.8; 0.8*4 + 0.4 = 3.6
      const model = fitLinearRegression(x, y);

      assertClose(model.coefficients.b, 0.8, 1e-12);
      assertClose(model.coefficients.a, 0.4, 1e-12);
      assertEqual(model.metadata.centered, true);
    });

    it("should fit noisy but valid academic transition data", () => {
      // Synthetic academic transitions:
      // s_t = [2.8, 3.0, 3.2, 3.5, 3.8]
      // s_{t+1} = [2.9, 3.1, 3.15, 3.45, 3.75]
      const x = [2.8, 3.0, 3.2, 3.5, 3.8];
      const y = [2.9, 3.1, 3.15, 3.45, 3.75];

      const model = fitLinearRegression(x, y);
      assert(Number.isFinite(model.coefficients.a));
      assert(Number.isFinite(model.coefficients.b));
      assert(model.coefficients.b > 0, "Slope should be positive (academic persistence)");
    });

    it("should reject constant or near-zero variance predictors with clear error", () => {
      // All students had identical previous SGPA of 3.50
      const x = [3.50, 3.50, 3.50, 3.50];
      const y = [3.40, 3.50, 3.60, 3.70];

      assertThrows(
        () => fitLinearRegression(x, y),
        Error,
        "Constant predictor must throw due to rank deficiency"
      );
    });

    it("should reject insufficient observations (n < 2)", () => {
      assertThrows(() => fitLinearRegression([3.2], [3.4]), Error, "n=1 must throw");
      assertThrows(() => fitLinearRegression([], []), Error, "Empty arrays must throw");
    });

    it("should preserve raw prediction output without silent clamping when out of scale", () => {
      // Line with steep slope that extrapolates above 4.00
      const x = [2.0, 3.0, 4.0];
      const y = [2.2, 3.2, 4.0]; // Slope ~ 0.9, Intercept ~ 0.43
      const model = fitLinearRegression(x, y, { scaleMax: 4.00 });

      // Predict for student with SGPA = 4.00 -> raw prediction will exceed 4.00
      const pred = model.predict(4.00);
      assert(pred.rawPrediction > 3.9, "Raw calculation must be preserved");
      // If we test an extreme input x = 4.50:
      const extremePred = model.predict(4.50);
      assert(extremePred.rawPrediction > 4.00, "Raw prediction must exceed 4.00 without clamping");
      assertEqual(extremePred.isOutOfRange, true, "isOutOfRange must be true");
    });

    it("should fit regression from validated transition records correctly", () => {
      const transitions = [
        { student_key: "S1", from_semester: 1, to_semester: 2, previous_sgpa: 3.0, next_sgpa: 3.2 },
        { student_key: "S1", from_semester: 2, to_semester: 3, previous_sgpa: 3.2, next_sgpa: 3.4 },
        { student_key: "S2", from_semester: 1, to_semester: 2, previous_sgpa: 3.5, next_sgpa: 3.6 }
      ];
      const model = fitTransitionRegression(transitions);
      assertEqual(model.sampleCount, 3);
      assert(Number.isFinite(model.coefficients.a));
      assert(Number.isFinite(model.coefficients.b));
    });

    it("should not mutate the caller's input arrays", () => {
      const x = [2.0, 3.0, 4.0];
      const y = [2.5, 3.5, 3.8];
      const xJson = JSON.stringify(x);
      const yJson = JSON.stringify(y);

      fitLinearRegression(x, y);

      assertEqual(JSON.stringify(x), xJson, "Array x must not be mutated");
      assertEqual(JSON.stringify(y), yJson, "Array y must not be mutated");
    });
  });
}
