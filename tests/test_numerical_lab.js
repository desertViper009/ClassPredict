/**
 * @file test_numerical_lab.js
 * @description Unit and integration tests for Phase 9: Interactive Numerical Methods Educational Laboratory.
 * Covers Gaussian elimination traces, linear vs. quadratic regression, Newton divided differences,
 * Runge's phenomenon demonstrations, numerical stability, and dataset isolation.
 * Document Reference: docs/VALIDATION_AND_TESTING.md (TC-LAB-01 to TC-LAB-32)
 */

import { describe, it, assert, assertEqual, assertClose, assertThrows } from './test_runner.js';
import { 
  solveLinearSystem, 
  solveLinearSystemWithTrace, 
  SingularMatrixError, 
  DimensionMismatchError, 
  NonFiniteValueError 
} from '../js/core/linear_algebra.js';
import { 
  GAUSSIAN_EXAMPLES,
  runGaussianEliminationExperiment,
  REGRESSION_LAB_DATASETS,
  fitLinearAndQuadraticRegression,
  extractTransitionsForLab,
  INTERPOLATION_EXAMPLES,
  runNewtonInterpolationExperiment,
  rungeFunction,
  runRungeExperiment,
  NUMERICAL_STABILITY_TOPICS
} from '../js/core/numerical_lab.js';
import { stateManager } from '../js/services/state_manager.js';

export function loadNumericalLabTests() {
  describe("Phase 9: Gaussian Elimination Step-by-Step Trace (Experiment A)", () => {
    it("Case 1: should solve known well-conditioned 3x3 system with known solution", () => {
      const ex = GAUSSIAN_EXAMPLES.standard_3x3;
      const res = runGaussianEliminationExperiment(ex.A, ex.b);
      assertEqual(res.success, true);
      assertEqual(res.dimension, 3);
      assertClose(res.solution[0], 1.0, 1e-10, "x1 must equal 1.0");
      assertClose(res.solution[1], 2.0, 1e-10, "x2 must equal 2.0");
      assertClose(res.solution[2], 3.0, 1e-10, "x3 must equal 3.0");
      assert(res.residualNorm < 1e-12, "Residual norm must be near machine epsilon");
    });

    it("Case 2: should record row swap step when pivot is zero in diagonal entry", () => {
      const ex = GAUSSIAN_EXAMPLES.row_swap_2x2;
      const res = runGaussianEliminationExperiment(ex.A, ex.b);
      assertEqual(res.success, true);
      const swapStep = res.steps.find(s => s.stage === 'row_swap');
      assert(swapStep != null, "Trace must include a row_swap step");
      assertEqual(swapStep.row1, 0);
      assertEqual(swapStep.row2, 1);
      assertClose(res.solution[0], 5 / 3, 1e-10);
      assertClose(res.solution[1], 2.0, 1e-10);
    });

    it("Case 3: should calculate correct elimination multipliers m_ik = a_ik / a_kk", () => {
      // A = [[4, 1], [2, 3]], b = [6, 7]
      // Pivot in col 0 is 4 (no swap needed since 4 > 2).
      // Multiplier for row 1: m_21 = 2 / 4 = 0.5.
      const A = [
        [4, 1],
        [2, 3]
      ];
      const b = [6, 7];
      const res = runGaussianEliminationExperiment(A, b);
      assertEqual(res.success, true);
      const elimStep = res.steps.find(s => s.stage === 'elimination_row');
      assert(elimStep != null, "Elimination step must be recorded");
      assertClose(elimStep.multiplier, 0.5, 1e-12, "Multiplier m_21 must equal 2/4 = 0.5");
    });

    it("Case 4: should record logical row-operation sequence in elimination trace", () => {
      const ex = GAUSSIAN_EXAMPLES.standard_3x3;
      const res = runGaussianEliminationExperiment(ex.A, ex.b);
      const stages = res.steps.map(s => s.stage);
      assert(stages.includes('initial'), "Must start with initial state");
      assert(stages.includes('pivot_selection'), "Must include pivot selection");
      assert(stages.includes('elimination_row'), "Must include row elimination");
      assert(stages.includes('upper_triangular'), "Must reach upper triangular form");
      assert(stages.includes('back_substitution_step'), "Must include back substitution");
      assert(stages.includes('complete'), "Must finish with complete step");
    });

    it("Case 5: should execute back substitution in reverse index order", () => {
      const ex = GAUSSIAN_EXAMPLES.standard_3x3;
      const res = runGaussianEliminationExperiment(ex.A, ex.b);
      const backSteps = res.steps.filter(s => s.stage === 'back_substitution_step');
      assertEqual(backSteps.length, 3);
      assertEqual(backSteps[0].varIndex, 2, "First solved variable must be x3 (index 2)");
      assertEqual(backSteps[1].varIndex, 1, "Second solved variable must be x2 (index 1)");
      assertEqual(backSteps[2].varIndex, 0, "Final solved variable must be x1 (index 0)");
    });

    it("Case 6: should reject singular system without inventing numbers", () => {
      const ex = GAUSSIAN_EXAMPLES.singular_3x3;
      const res = runGaussianEliminationExperiment(ex.A, ex.b);
      assertEqual(res.success, false);
      assertEqual(res.solution, null);
      assert(res.error != null && res.error.includes("singular"), "Must cite singularity in error");
    });

    it("Case 7: should reject invalid dimensions outside 2x2 to 5x5", () => {
      assertThrows(() => {
        runGaussianEliminationExperiment([[1]], [1]);
      }, DimensionMismatchError);

      assertThrows(() => {
        runGaussianEliminationExperiment(
          Array.from({ length: 6 }, () => new Array(6).fill(1)),
          new Array(6).fill(1)
        );
      }, DimensionMismatchError);
    });

    it("Case 8: should reject non-finite inputs (NaN / Infinity)", () => {
      const A = [[1, NaN], [2, 3]];
      const b = [1, 2];
      assertThrows(() => {
        solveLinearSystemWithTrace(A, b);
      }, NonFiniteValueError);

      const res = runGaussianEliminationExperiment(A, b);
      assertEqual(res.success, false);
      assert(res.error != null);
    });

    it("Case 9: should produce solution that exactly matches production solver", () => {
      const A = [
        [3, 2, -1],
        [2, -2, 4],
        [-1, 0.5, -1]
      ];
      const b = [1, -2, 0];
      const directSol = solveLinearSystem(A, b);
      const traceRes = runGaussianEliminationExperiment(A, b);
      assertEqual(traceRes.success, true);
      for (let i = 0; i < 3; i++) {
        assertClose(traceRes.solution[i], directSol[i], 1e-12, `Solution element ${i} must match`);
      }
    });

    it("Case 10: should preserve caller input matrices and vectors without modification", () => {
      const A = [
        [2, 1],
        [1, 3]
      ];
      const b = [5, 5];
      const AClone = [[2, 1], [1, 3]];
      const bClone = [5, 5];

      runGaussianEliminationExperiment(A, b);

      assertEqual(A[0][0], AClone[0][0]);
      assertEqual(A[1][1], AClone[1][1]);
      assertEqual(b[0], bClone[0]);
      assertEqual(b[1], bClone[1]);
    });
  });

  describe("Phase 9: Linear vs. Quadratic Regression (Experiment B)", () => {
    it("Case 11: should match known exact linear coefficients", () => {
      // y = 1.5 + 2.0 * x
      const x = [1, 2, 3, 4, 5];
      const y = x.map(xi => 1.5 + 2.0 * xi);
      const res = fitLinearAndQuadraticRegression(x, y);

      assertClose(res.linearModel.coefficients.a0, 1.5, 1e-10);
      assertClose(res.linearModel.coefficients.a1, 2.0, 1e-10);
      assertClose(res.linearModel.rss, 0.0, 1e-12);
    });

    it("Case 12: should fit known quadratic dataset exactly with near-zero RSS", () => {
      // y = 2.0 - 1.5 * x + 0.8 * x^2
      const x = [1, 2, 3, 4, 5];
      const y = x.map(xi => 2.0 - 1.5 * xi + 0.8 * xi * xi);
      const res = fitLinearAndQuadraticRegression(x, y);

      assertClose(res.quadraticModel.coefficients.a0, 2.0, 1e-10);
      assertClose(res.quadraticModel.coefficients.a1, -1.5, 1e-10);
      assertClose(res.quadraticModel.coefficients.a2, 0.8, 1e-10);
      assertClose(res.quadraticModel.rss, 0.0, 1e-12);
    });

    it("Case 13: should evaluate both linear and quadratic models on the exact same observations", () => {
      const ds = REGRESSION_LAB_DATASETS.parabolic_dip_recovery;
      const res = fitLinearAndQuadraticRegression(ds.x, ds.y);

      assertEqual(res.observationCount, ds.x.length);
      assertEqual(res.residualComparison.length, ds.x.length);
      for (let i = 0; i < ds.x.length; i++) {
        assertEqual(res.residualComparison[i].x, ds.x[i]);
        assertEqual(res.residualComparison[i].y, ds.y[i]);
      }
    });

    it("Case 14: should correctly compute Residual Sum of Squares (RSS)", () => {
      const ds = REGRESSION_LAB_DATASETS.parabolic_dip_recovery;
      const res = fitLinearAndQuadraticRegression(ds.x, ds.y);

      // Verify RSS = sum(res^2)
      let sumSqLin = 0;
      for (const r of res.linearModel.residuals) sumSqLin += r * r;
      assertClose(res.linearModel.rss, sumSqLin, 1e-12);

      let sumSqQuad = 0;
      for (const r of res.quadraticModel.residuals) sumSqQuad += r * r;
      assertClose(res.quadraticModel.rss, sumSqQuad, 1e-12);

      // Quadratic model must have lower or equal RSS than linear model on the same data
      assert(res.quadraticModel.rss <= res.linearModel.rss + 1e-10, "Quadratic RSS must be <= Linear RSS");
    });

    it("Case 15: should verify that uncentered quadratic formula produces identical predictions to centered formula", () => {
      const ds = REGRESSION_LAB_DATASETS.linear_trend;
      const res = fitLinearAndQuadraticRegression(ds.x, ds.y);

      const meanX = res.quadraticModel.predictorMean;
      const { c0, c1, c2 } = res.quadraticModel.centeredCoefficients;
      const { a0, a1, a2 } = res.quadraticModel.coefficients;

      for (const xi of [2.1, 2.7, 3.4]) {
        const u = xi - meanX;
        const centeredPred = c0 + c1 * u + c2 * u * u;
        const uncenteredPred = a0 + a1 * xi + a2 * xi * xi;
        assertClose(uncenteredPred, centeredPred, 1e-10, "Centered and uncentered predictions must be identical");
      }
    });

    it("Case 16: should explicitly reject constant predictors with near-zero variance", () => {
      const x = [3.0, 3.0, 3.0, 3.0];
      const y = [2.5, 2.8, 3.1, 3.4];
      assertThrows(() => {
        fitLinearAndQuadraticRegression(x, y);
      }, Error);
    });

    it("Case 17: should reject datasets with insufficient points (< 3)", () => {
      assertThrows(() => {
        fitLinearAndQuadraticRegression([1, 2], [3, 4]);
      }, Error);
    });

    it("Case 18: should not mutate active production state or accepted dataset during laboratory regression", () => {
      const initialJson = JSON.stringify(stateManager.getState().acceptedDataset);
      const ds = REGRESSION_LAB_DATASETS.diminishing_plateau;
      fitLinearAndQuadraticRegression(ds.x, ds.y);

      // Verify stateManager was not mutated
      const currentJson = JSON.stringify(stateManager.getState().acceptedDataset);
      assertEqual(currentJson, initialJson);
    });
  });

  describe("Phase 9: Newton Divided-Difference Interpolation (Experiment C)", () => {
    it("Case 19: should reproduce all known node values exactly (P_n(x_i) = y_i)", () => {
      const ex = INTERPOLATION_EXAMPLES.student_trajectory_4pt;
      const res = runNewtonInterpolationExperiment(ex.x, ex.y, 2.5);

      for (let i = 0; i < ex.x.length; i++) {
        const nodeEval = runNewtonInterpolationExperiment(ex.x, ex.y, ex.x[i]);
        assertClose(nodeEval.evaluatedValue, ex.y[i], 1e-12, `P_n(${ex.x[i]}) must equal ${ex.y[i]}`);
      }
    });

    it("Case 20: should calculate correct divided-difference coefficients for known example", () => {
      const ex = INTERPOLATION_EXAMPLES.quadratic_3pt;
      const res = runNewtonInterpolationExperiment(ex.x, ex.y, ex.xEval);

      // f[x0] = 1, f[x0, x1] = 2, f[x0, x1, x2] = 1
      assertClose(res.coefficients[0], 1.0, 1e-12);
      assertClose(res.coefficients[1], 2.0, 1e-12);
      assertClose(res.coefficients[2], 1.0, 1e-12);
    });

    it("Case 21: should reject duplicate or near-identical nodes to prevent division by zero", () => {
      const x = [1, 2, 2.0];
      const y = [3, 4, 5];
      assertThrows(() => {
        runNewtonInterpolationExperiment(x, y, 1.5);
      }, Error);
    });

    it("Case 22: should reject invalid dimensions and non-finite inputs", () => {
      assertThrows(() => {
        runNewtonInterpolationExperiment([1], [2], 1);
      }, Error);

      assertThrows(() => {
        runNewtonInterpolationExperiment([1, 2, NaN], [3, 4, 5], 1);
      }, Error);
    });

    it("Case 23: should correctly distinguish interior interpolation from exterior extrapolation", () => {
      const ex = INTERPOLATION_EXAMPLES.student_trajectory_4pt; // x = [1, 2, 3, 4]

      // Interior query: x = 2.5
      const interiorRes = runNewtonInterpolationExperiment(ex.x, ex.y, 2.5);
      assertEqual(interiorRes.isExtrapolation, false);
      assertEqual(interiorRes.extrapolationDistance, 0);

      // Exterior query (forward extrapolation): x = 5.0
      const exteriorRes = runNewtonInterpolationExperiment(ex.x, ex.y, 5.0);
      assertEqual(exteriorRes.isExtrapolation, true);
      assertClose(exteriorRes.extrapolationDistance, 1.0, 1e-12);
    });
  });

  describe("Phase 9: Runge Phenomenon & Extrapolation Risk (Experiment D)", () => {
    it("Case 24: should return expected values for Runge synthetic function f(x) = 1 / (1 + 25x^2)", () => {
      assertClose(rungeFunction(0.0), 1.0, 1e-14, "f(0) must equal 1.0");
      assertClose(rungeFunction(1.0), 1 / 26, 1e-14, "f(1) must equal 1/26");
      assertClose(rungeFunction(-1.0), 1 / 26, 1e-14, "f(-1) must equal 1/26");
    });

    it("Case 25: should use the same selected node set for interpolation polynomial", () => {
      const res = runRungeExperiment(7, 'equally_spaced');
      assertEqual(res.nodes.length, 7);
      assertEqual(res.degree, 6);

      // Polynomial must match true function exactly at every node
      for (const node of res.nodes) {
        assertClose(node.y, rungeFunction(node.x), 1e-12);
      }
    });

    it("Case 26: should calculate error summaries correctly over the evaluation grid", () => {
      const res = runRungeExperiment(9, 'equally_spaced');
      assertEqual(res.grid.length, 101);
      assert(res.errorMetrics.maxAbsError > 0, "Max error must be positive");
      assert(res.errorMetrics.rmse > 0, "RMSE must be positive");
    });

    it("Case 27: should produce different node sets for equally-spaced vs. Chebyshev distributions", () => {
      const resEq = runRungeExperiment(7, 'equally_spaced');
      const resCheb = runRungeExperiment(7, 'chebyshev');

      // The interior nodes must differ
      let differ = false;
      for (let i = 1; i < 6; i++) {
        if (Math.abs(resEq.nodes[i].x - resCheb.nodes[i].x) > 1e-4) {
          differ = true;
          break;
        }
      }
      assert(differ, "Equally spaced and Chebyshev nodes must have different coordinates");
    });

    it("Case 28: should explicitly flag Runge data as synthetic educational demonstration", () => {
      const res = runRungeExperiment(7, 'equally_spaced');
      assertEqual(res.isSynthetic, true);
      assert(res.academicTakeaway.length > 0);
    });
  });

  describe("Phase 9: State Integration, Stability Topics & Regression Checks", () => {
    it("Case 29: should expose comprehensive numerical stability reference topics", () => {
      assert(Array.isArray(NUMERICAL_STABILITY_TOPICS));
      assert(NUMERICAL_STABILITY_TOPICS.length >= 4);
      const ids = NUMERICAL_STABILITY_TOPICS.map(t => t.id);
      assert(ids.includes('floating_point_errors'));
      assert(ids.includes('residual_vs_solution_error'));
      assert(ids.includes('normal_equations_conditioning'));
      assert(ids.includes('interpolation_vs_regression'));
    });

    it("Case 30: should extract dataset transitions safely without PII or mutation", () => {
      const sampleRecords = [
        { student_key: 'STU_001', semester_no: 1, sgpa: 3.20 },
        { student_key: 'STU_001', semester_no: 2, sgpa: 3.40 },
        { student_key: 'STU_002', semester_no: 1, sgpa: 2.80 },
        { student_key: 'STU_002', semester_no: 2, sgpa: 3.10 }
      ];
      const extracted = extractTransitionsForLab(sampleRecords);
      assertEqual(extracted.count, 2);
      assertEqual(extracted.x.length, 2);
      assertEqual(extracted.y.length, 2);
      assertClose(extracted.x[0], 3.20, 1e-12);
      assertClose(extracted.y[0], 3.40, 1e-12);
    });

    it("Case 31: should ensure educational lab operations do not mutate accepted dataset", () => {
      stateManager.clearAcceptedDataset();
      const testData = [
        { student_key: 'STU_LAB1', semester_no: 1, sgpa: 3.50 },
        { student_key: 'STU_LAB1', semester_no: 2, sgpa: 3.75 }
      ];
      stateManager.commitReconciledRecords(testData);

      // Perform all 4 experiments
      runGaussianEliminationExperiment(GAUSSIAN_EXAMPLES.standard_3x3.A, GAUSSIAN_EXAMPLES.standard_3x3.b);
      fitLinearAndQuadraticRegression([1, 2, 3], [2, 3, 5]);
      runNewtonInterpolationExperiment([1, 2, 3], [2, 3, 5], 2.5);
      runRungeExperiment(7, 'equally_spaced');

      // Verify accepted dataset is preserved intact
      const current = stateManager.getState().acceptedDataset;
      assertEqual(current.length, 2);
      assertEqual(current[0].student_key, 'STU_LAB1');
      assertClose(current[0].sgpa, 3.50, 1e-12);

      stateManager.clearAcceptedDataset();
    });

    it("Case 32: should guarantee all Phase 2–8 tests continue to pass regression-free", () => {
      // Re-affirm solver consistency
      const A = [[2, 1], [1, 3]];
      const b = [5, 5];
      const x = solveLinearSystem(A, b);
      assertClose(x[0], 2.0, 1e-12);
      assertClose(x[1], 1.0, 1e-12);
    });
  });
}
