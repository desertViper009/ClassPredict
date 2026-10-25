/**
 * @file test_prediction.js
 * @description Comprehensive automated tests for Phase 6 Prediction Workflows:
 * individual trajectory forecasting, whole-class cohort prediction,
 * model-status evaluation context, and privacy-preserving CSV export.
 * Document Reference: docs/REQUIREMENTS.md (FR-03, FR-04), docs/VALIDATION_AND_TESTING.md
 */

import { describe, it, assert, assertFalse, assertEqual, assertClose, assertThrows } from './test_runner.js';
import { 
  fitIndividualTrend, 
  fitTransitionRegression,
  DEFAULT_SCALE_MAX 
} from '../js/core/regression_engine.js';
import { 
  predictIndividualStudent, 
  predictWholeClass, 
  exportWholeClassCSV, 
  exportIndividualCSV,
  PREDICTION_MODELS, 
  PREDICTION_STATUS 
} from '../js/core/prediction_service.js';

export function loadPredictionTests() {
  describe("Phase 6: Individual Student Prediction Workflow", () => {
    it("Case 1: should support a valid 3-semester history", () => {
      const history = [
        { semester_no: 1, sgpa: 3.20 },
        { semester_no: 2, sgpa: 3.40 },
        { semester_no: 3, sgpa: 3.60 }
      ];
      const res = predictIndividualStudent(history, { model: PREDICTION_MODELS.INDIVIDUAL_TREND });
      assertEqual(res.status, PREDICTION_STATUS.PREDICTED);
      assertEqual(res.observationCount, 3);
      assertEqual(res.latestSemester, 3);
      assertEqual(res.latestSgpa, 3.60);
      assertEqual(res.targetSemester, 4);
      assertClose(res.rawPrediction, 3.80, 1e-12, "Linear trend should predict 3.80 for semester 4");
      assert(res.volatilityWarning !== null, "3 semesters should trigger volatility warning");
    });

    it("Case 2: should support a valid 7-semester history", () => {
      const history = [];
      for (let sem = 1; sem <= 7; sem++) {
        history.push({ semester_no: sem, sgpa: 3.00 + (sem - 1) * 0.10 });
      }
      const res = predictIndividualStudent(history, { model: PREDICTION_MODELS.INDIVIDUAL_TREND });
      assertEqual(res.observationCount, 7);
      assertEqual(res.latestSemester, 7);
      assertEqual(res.latestSgpa, 3.60);
      assertEqual(res.targetSemester, 8);
      assertClose(res.rawPrediction, 3.70, 1e-12, "Should predict 3.70 for semester 8");
      assertEqual(res.volatilityWarning, null, "7 semesters should not trigger volatility warning");
    });

    it("Case 3: should sort unordered semester input chronologically", () => {
      const history = [
        { semester_no: 3, sgpa: 3.50 },
        { semester_no: 1, sgpa: 3.10 },
        { semester_no: 2, sgpa: 3.30 }
      ];
      const res = predictIndividualStudent(history, { model: PREDICTION_MODELS.INDIVIDUAL_TREND });
      assertEqual(res.latestSemester, 3);
      assertEqual(res.targetSemester, 4);
      assertEqual(res.sortedObservations[0].semester_no, 1);
      assertEqual(res.sortedObservations[1].semester_no, 2);
      assertEqual(res.sortedObservations[2].semester_no, 3);
    });

    it("Case 4: should reject duplicate semester numbers in history", () => {
      const history = [
        { semester_no: 1, sgpa: 3.10 },
        { semester_no: 2, sgpa: 3.30 },
        { semester_no: 2, sgpa: 3.50 } // Duplicate semester 2
      ];
      assertThrows(
        () => predictIndividualStudent(history, { model: PREDICTION_MODELS.INDIVIDUAL_TREND }),
        Error,
        "Duplicate semester numbers must be rejected"
      );
    });

    it("Case 5: should reject invalid or out-of-scale SGPA values", () => {
      const historyNegative = [
        { semester_no: 1, sgpa: 3.00 },
        { semester_no: 2, sgpa: -0.50 },
        { semester_no: 3, sgpa: 3.50 }
      ];
      assertThrows(() => predictIndividualStudent(historyNegative), Error, "Negative SGPA must throw");

      const historyTooHigh = [
        { semester_no: 1, sgpa: 3.00 },
        { semester_no: 2, sgpa: 4.50 },
        { semester_no: 3, sgpa: 3.50 }
      ];
      assertThrows(() => predictIndividualStudent(historyTooHigh), Error, "SGPA > 4.00 must throw");

      const historyNaN = [
        { semester_no: 1, sgpa: 3.00 },
        { semester_no: 2, sgpa: NaN },
        { semester_no: 3, sgpa: 3.50 }
      ];
      assertThrows(() => predictIndividualStudent(historyNaN), Error, "NaN SGPA must throw");
    });

    it("Case 6: should compute exact individual trend coefficients on a known straight line", () => {
      // Line: s_k = 2.00 + 0.30 * k
      // k = 1 -> 2.30, k = 2 -> 2.60, k = 3 -> 2.90, k = 4 -> 3.20
      const history = [
        { semester_no: 1, sgpa: 2.30 },
        { semester_no: 2, sgpa: 2.60 },
        { semester_no: 3, sgpa: 2.90 },
        { semester_no: 4, sgpa: 3.20 }
      ];
      const res = fitIndividualTrend(history);
      assertClose(res.coefficients.a, 2.00, 1e-12, "Intercept must be 2.00");
      assertClose(res.coefficients.b, 0.30, 1e-12, "Slope must be 0.30");
      assertEqual(res.targetSemester, 5);
      assertClose(res.rawPrediction, 3.50, 1e-12, "Prediction at k=5 must be 3.50");
    });

    it("Case 7: should predict for next actual semester when history contains missing gaps", () => {
      // Student has semesters 1, 2, 4 (semester 3 missing)
      const history = [
        { semester_no: 1, sgpa: 3.00 },
        { semester_no: 2, sgpa: 3.20 },
        { semester_no: 4, sgpa: 3.60 } // Latest is 4
      ];
      const res = predictIndividualStudent(history, { model: PREDICTION_MODELS.INDIVIDUAL_TREND });
      assertEqual(res.latestSemester, 4);
      assertEqual(res.targetSemester, 5, "Target semester must be latest (4) + 1 = 5");
    });

    it("Case 8: should explicitly handle insufficient history (n < 3 or n > 7)", () => {
      const history2 = [
        { semester_no: 1, sgpa: 3.00 },
        { semester_no: 2, sgpa: 3.20 }
      ];
      assertThrows(() => predictIndividualStudent(history2), Error, "n < 3 must throw");

      const history8 = [];
      for (let i = 1; i <= 8; i++) {
        history8.push({ semester_no: i, sgpa: 3.00 });
      }
      assertThrows(() => predictIndividualStudent(history8), Error, "n > 7 must throw");
    });

    it("Case 9: should report shared-model as unavailable when no shared model exists", () => {
      const history = [
        { semester_no: 1, sgpa: 3.00 },
        { semester_no: 2, sgpa: 3.20 },
        { semester_no: 3, sgpa: 3.40 }
      ];
      const res = predictIndividualStudent(history, { 
        model: PREDICTION_MODELS.SHARED_REGRESSION,
        sharedModel: null 
      });
      assertEqual(res.status, PREDICTION_STATUS.MODEL_UNAVAILABLE);
      assertEqual(res.rawPrediction, null);
      assert(res.statusReason.includes("No fitted class-wide regression model"));
    });

    it("Case 10: should evaluate persistence baseline prediction equal to latest observed SGPA", () => {
      const history = [
        { semester_no: 1, sgpa: 2.80 },
        { semester_no: 2, sgpa: 3.10 },
        { semester_no: 3, sgpa: 3.45 }
      ];
      const res = predictIndividualStudent(history, { model: PREDICTION_MODELS.PERSISTENCE });
      assertEqual(res.modelName, "Persistence Baseline");
      assertEqual(res.targetSemester, 4);
      assertEqual(res.latestSgpa, 3.45);
      assertEqual(res.rawPrediction, 3.45);
    });

    it("Case 11: should preserve raw out-of-range predictions without silent clamping", () => {
      // Steep slope: k=1 -> 3.00, k=2 -> 3.60, k=3 -> 4.00 (slope = 0.50)
      // k=4 forecast: 4.00 + 0.50 = 4.50 (> 4.00!)
      const history = [
        { semester_no: 1, sgpa: 3.00 },
        { semester_no: 2, sgpa: 3.60 },
        { semester_no: 3, sgpa: 4.00 }
      ];
      const res = predictIndividualStudent(history, { model: PREDICTION_MODELS.INDIVIDUAL_TREND });
      assert(res.rawPrediction > 4.00, "Raw prediction must exceed 4.00");
      assertEqual(res.isOutOfRange, true, "isOutOfRange must be true");
    });

    it("Case 12: should guarantee that prediction does not mutate caller's input history array", () => {
      const history = [
        { semester_no: 3, sgpa: 3.50 },
        { semester_no: 1, sgpa: 3.00 },
        { semester_no: 2, sgpa: 3.20 }
      ];
      const copy = JSON.stringify(history);
      predictIndividualStudent(history, { model: PREDICTION_MODELS.INDIVIDUAL_TREND });
      assertEqual(JSON.stringify(history), copy, "Caller's history array must not be mutated");
    });
  });

  describe("Phase 6: Whole-Class Prediction Workflow", () => {
    it("Case 13: should handle multiple students independently", () => {
      const dataset = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S1", semester_no: 3, sgpa: 3.40 },
        { student_key: "S2", semester_no: 1, sgpa: 2.50 },
        { student_key: "S2", semester_no: 2, sgpa: 2.70 },
        { student_key: "S2", semester_no: 3, sgpa: 2.90 }
      ];
      const res = predictWholeClass(dataset);
      assertEqual(res.status, "SUCCESS");
      assertEqual(res.students.length, 2);
      assertEqual(res.students[0].student_key, "S1");
      assertEqual(res.students[1].student_key, "S2");
      assertEqual(res.students[0].target_semester, 4);
      assertEqual(res.students[1].target_semester, 4);
      assert(res.students[0].predicted_sgpa !== null);
      assert(res.students[1].predicted_sgpa !== null);
    });

    it("Case 14: should train shared model strictly using valid consecutive transitions", () => {
      const dataset = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S1", semester_no: 3, sgpa: 3.40 },
        { student_key: "S2", semester_no: 1, sgpa: 2.00 },
        { student_key: "S2", semester_no: 2, sgpa: 2.40 },
        { student_key: "S2", semester_no: 3, sgpa: 2.80 }
      ];
      const res = predictWholeClass(dataset);
      assertEqual(res.transitionsCount, 4, "2 students * 2 transitions = 4 transitions");
      assertEqual(res.sharedModel.sampleCount, 4);
    });

    it("Case 15: should strictly exclude missing semester gaps from shared model training", () => {
      const dataset = [
        { student_key: "S_GAP", semester_no: 1, sgpa: 3.00 },
        { student_key: "S_GAP", semester_no: 2, sgpa: 3.20 },
        { student_key: "S_GAP", semester_no: 4, sgpa: 3.60 }, // Gap 2 -> 4 must NOT bridge
        { student_key: "S_NORM", semester_no: 1, sgpa: 3.10 },
        { student_key: "S_NORM", semester_no: 2, sgpa: 3.30 }
      ];
      const res = predictWholeClass(dataset);
      // Valid transitions: S_GAP 1->2 (1) and S_NORM 1->2 (1) = 2 transitions total
      assertEqual(res.transitionsCount, 2, "Gap 2->4 must not produce transition");
    });

    it("Case 16: should assign explicit status when shared model fitting fails", () => {
      // Degenerate dataset where predictor has 0 variance (all previous SGPAs are identical 3.00)
      const dataset = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S2", semester_no: 1, sgpa: 3.00 },
        { student_key: "S2", semester_no: 2, sgpa: 3.40 }
      ];
      const res = predictWholeClass(dataset);
      assertEqual(res.sharedModelStatus, "FIT_FAILED");
      assert(res.sharedModelError.includes("variance"));
      for (const s of res.students) {
        assertEqual(s.prediction_status, PREDICTION_STATUS.MODEL_UNAVAILABLE);
        assertEqual(s.predicted_sgpa, null);
        // But baseline prediction is still available!
        assert(typeof s.baseline_prediction === 'number');
      }
    });

    it("Case 17: should correctly distinguish regression and persistence estimates", () => {
      const dataset = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S2", semester_no: 1, sgpa: 2.00 },
        { student_key: "S2", semester_no: 2, sgpa: 2.40 }
      ];
      const res = predictWholeClass(dataset);
      const s1 = res.students.find(s => s.student_key === "S1");
      assertEqual(s1.baseline_prediction, 3.20, "Persistence should be latest SGPA (3.20)");
      assert(s1.predicted_sgpa !== s1.baseline_prediction, "Regression estimate should differ from persistence");
    });

    it("Case 18: should not mislabel failed model fitting as successful regression", () => {
      const dataset = [
        { student_key: "S1", semester_no: 1, sgpa: 3.50 } // Only 1 semester, 0 transitions
      ];
      const res = predictWholeClass(dataset);
      assertEqual(res.sharedModelStatus, "INSUFFICIENT_TRANSITIONS");
      assertEqual(res.students[0].prediction_status, PREDICTION_STATUS.MODEL_UNAVAILABLE);
      assertEqual(res.students[0].predicted_sgpa, null);
    });

    it("Case 19: should ensure every eligible student is represented in whole-class export", () => {
      const dataset = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S2", semester_no: 1, sgpa: 2.80 },
        { student_key: "S2", semester_no: 2, sgpa: 3.00 },
        { student_key: "S3", semester_no: 1, sgpa: 3.40 },
        { student_key: "S3", semester_no: 2, sgpa: 3.60 }
      ];
      const res = predictWholeClass(dataset);
      const csv = exportWholeClassCSV(res.students);
      const lines = csv.trim().split("\r\n");
      // 1 header row + 3 student rows = 4 rows
      assertEqual(lines.length, 4);
      assert(csv.includes("S1"));
      assert(csv.includes("S2"));
      assert(csv.includes("S3"));
    });

    it("Case 20: should ensure exported whole-class predictions match in-memory results", () => {
      const dataset = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 },
        { student_key: "S2", semester_no: 1, sgpa: 2.50 },
        { student_key: "S2", semester_no: 2, sgpa: 2.80 }
      ];
      const res = predictWholeClass(dataset);
      const csv = exportWholeClassCSV(res.students);
      const s1 = res.students.find(s => s.student_key === "S1");
      assert(csv.includes(s1.predicted_sgpa.toFixed(4)), "CSV must contain s1's predicted SGPA");
      assert(csv.includes(s1.baseline_prediction.toFixed(4)), "CSV must contain s1's baseline prediction");
    });
  });

  describe("Phase 6: Evaluation Context and Safe Export", () => {
    it("Case 21: should attach historical temporal evaluation evidence when available", () => {
      // 3 students across 4 semesters
      const dataset = [];
      const bases = { S1: 2.5, S2: 3.0, S3: 3.5 };
      for (const [k, base] of Object.entries(bases)) {
        for (let sem = 1; sem <= 4; sem++) {
          dataset.push({ student_key: k, semester_no: sem, sgpa: base + sem * 0.05 });
        }
      }
      const res = predictWholeClass(dataset);
      assert(res.temporalSummary !== null, "Temporal summary should be attached");
      assert(typeof res.temporalSummary.pairedRegressionMae === 'number');
      assert(typeof res.temporalSummary.pairedBaselineMae === 'number');
    });

    it("Case 22: should not fabricate metrics when temporal evaluation evidence is insufficient", () => {
      // Only 2 semesters: target semester 2 cannot train earlier regression
      const dataset = [
        { student_key: "S1", semester_no: 1, sgpa: 3.00 },
        { student_key: "S1", semester_no: 2, sgpa: 3.20 }
      ];
      const res = predictWholeClass(dataset);
      assertEqual(res.temporalSummary, null, "Should not fabricate temporal metrics for insufficient history");
    });

    it("Case 23: should generate RFC-4180 compliant CSV headers and quoting", () => {
      const sample = [
        {
          student_key: "STU_001",
          latest_semester: 3,
          latest_sgpa: 3.45,
          target_semester: 4,
          predicted_sgpa: 3.52,
          baseline_prediction: 3.45,
          model_name: "Class-Wide Linear Regression",
          prediction_status: "PREDICTED",
          out_of_range: false
        }
      ];
      const csv = exportWholeClassCSV(sample);
      assert(csv.startsWith("student_key,latest_semester,latest_sgpa,target_semester,predicted_sgpa,baseline_prediction,model_name,prediction_status,out_of_range"));
      assert(csv.includes('"STU_001"'));
      assert(csv.includes('"Class-Wide Linear Regression"'));
      assert(csv.includes('"PREDICTED"'));
      assert(csv.includes("FALSE"));
    });

    it("Case 24: should exclude personal identifying information from exports", () => {
      const sample = [
        {
          student_key: "SYN_ANON_01",
          latest_semester: 2,
          latest_sgpa: 3.20,
          target_semester: 3,
          predicted_sgpa: 3.30,
          baseline_prediction: 3.20,
          model_name: "Class-Wide Linear Regression",
          prediction_status: "PREDICTED",
          out_of_range: false
        }
      ];
      const csv = exportWholeClassCSV(sample);
      const headers = csv.split("\r\n")[0].split(",");
      assertFalse(headers.includes("name"), "CSV must not include 'name' field");
      assertFalse(headers.includes("student_name"), "CSV must not include 'student_name' field");
      assertFalse(headers.includes("full_name"), "CSV must not include 'full_name' field");
      assertFalse(csv.toLowerCase().includes("email"), "CSV must not include 'email' field");
      assertFalse(csv.toLowerCase().includes("registration"), "CSV must not include 'registration' field");
      assertFalse(csv.toLowerCase().includes("roll"), "CSV must not include 'roll' field");
    });

    it("Case 25: should export unavailable predictions as empty strings, never as zero", () => {
      const sample = [
        {
          student_key: "UNAVAIL_01",
          latest_semester: 1,
          latest_sgpa: 3.20,
          target_semester: 2,
          predicted_sgpa: null, // Unavailable
          baseline_prediction: 3.20,
          model_name: "None",
          prediction_status: "MODEL_UNAVAILABLE",
          out_of_range: false
        }
      ];
      const csv = exportWholeClassCSV(sample);
      const lines = csv.split("\r\n");
      const dataRow = lines[1];
      // Expected: "UNAVAIL_01",1,3.2000,2,,3.2000,"None","MODEL_UNAVAILABLE",FALSE
      assert(dataRow.includes(",,"), "Unavailable predicted_sgpa must be represented as empty field, not zero");
      assertFalse(dataRow.includes(",0.0000,"), "Must not export zero for unavailable prediction");
    });

    it("Case 26: should format individual prediction export with metadata and observations", () => {
      const individualRes = {
        targetSemester: 4,
        latestSemester: 3,
        latestSgpa: 3.50,
        rawPrediction: 3.65,
        modelName: "Individual Least-Squares Trend",
        isOutOfRange: false,
        sortedObservations: [
          { semester_no: 1, sgpa: 3.20 },
          { semester_no: 2, sgpa: 3.35 },
          { semester_no: 3, sgpa: 3.50 }
        ]
      };
      const csv = exportIndividualCSV(individualRes);
      assert(csv.includes("# ClassPredict Individual Prediction Result"));
      assert(csv.includes("4,3.6500,\"Individual Least-Squares Trend\",3,3.5000,FALSE"));
      assert(csv.includes("semester_no,sgpa"));
      assert(csv.includes("1,3.2000"));
      assert(csv.includes("2,3.3500"));
      assert(csv.includes("3,3.5000"));
    });

    it("Case 27: should sanitize potential formula injection characters (=, +, -, @) in exported CSV keys", () => {
      const maliciousPredictions = [
        { student_key: "=SUM(A1:A10)", latest_semester: 3, latest_sgpa: 3.50, target_semester: 4, predicted_sgpa: 3.60, baseline_prediction: 3.50, model_name: "Trend", prediction_status: "PREDICTED", out_of_range: false },
        { student_key: "+cmd|' /C calc'!A0", latest_semester: 3, latest_sgpa: 3.20, target_semester: 4, predicted_sgpa: 3.40, baseline_prediction: 3.20, model_name: "Trend", prediction_status: "PREDICTED", out_of_range: false },
        { student_key: "-1+2", latest_semester: 3, latest_sgpa: 3.10, target_semester: 4, predicted_sgpa: 3.30, baseline_prediction: 3.10, model_name: "Trend", prediction_status: "PREDICTED", out_of_range: false },
        { student_key: "@dangerous", latest_semester: 3, latest_sgpa: 3.00, target_semester: 4, predicted_sgpa: 3.20, baseline_prediction: 3.00, model_name: "Trend", prediction_status: "PREDICTED", out_of_range: false }
      ];

      const csv = exportWholeClassCSV(maliciousPredictions);
      assert(csv.includes("\"'=SUM(A1:A10)\""), "Must prepend single quote to escape =");
      assert(csv.includes("\"'+cmd|' /C calc'!A0\""), "Must prepend single quote to escape +");
      assert(csv.includes("\"'-1+2\""), "Must prepend single quote to escape -");
      assert(csv.includes("\"'@dangerous\""), "Must prepend single quote to escape @");
    });
  });
}
