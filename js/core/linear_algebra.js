/**
 * @file linear_algebra.js
 * @description Generic linear system solver using Gaussian elimination with row partial pivoting.
 * Pure mathematical implementation decoupled from the DOM.
 * Document Reference: docs/NUMERICAL_MODEL.md, docs/REQUIREMENTS.md (NFR-01, FR-07)
 */

import { isAllFinite, getSubmatrixScale } from './math_utils.js';

export const DEFAULT_RELATIVE_TOLERANCE = 1e-14;

/**
 * Custom error thrown when a matrix is singular or numerically rank-deficient.
 */
export class SingularMatrixError extends Error {
  constructor(message = "Matrix is singular or ill-conditioned for Gaussian elimination.") {
    super(message);
    this.name = "SingularMatrixError";
  }
}

/**
 * Custom error thrown when matrix and vector dimensions are incompatible.
 */
export class DimensionMismatchError extends Error {
  constructor(message = "Matrix and vector dimensions do not match.") {
    super(message);
    this.name = "DimensionMismatchError";
  }
}

/**
 * Custom error thrown when non-finite values (NaN, Infinity) are detected.
 */
export class NonFiniteValueError extends Error {
  constructor(message = "Non-finite value (NaN or Infinity) encountered in linear system.") {
    super(message);
    this.name = "NonFiniteValueError";
  }
}

/**
 * Deep clones a 2D matrix.
 * @param {number[][]} A 
 * @returns {number[][]}
 */
export function cloneMatrix(A) {
  return A.map(row => [...row]);
}

/**
 * Deep clones a 1D vector.
 * @param {number[]} b 
 * @returns {number[]}
 */
export function cloneVector(b) {
  return [...b];
}

/**
 * Solves the linear system A * x = b using Gaussian elimination with row partial pivoting.
 * 
 * Algorithm:
 * 1. Deep-copies A and b to preserve input immutability.
 * 2. In each elimination column k:
 *    - Computes submatrix scale s_scale = max_{i >= k, j >= k} |A_ij|.
 *    - Finds row p >= k maximizing |A_pk| (partial pivoting).
 *    - Verifies pivot satisfies scale-aware tolerance: |A_pk| >= relTol * s_scale.
 *    - Swaps rows p and k in both A and b.
 *    - Eliminates entries below the diagonal in column k.
 * 3. Solves for x via back-substitution.
 * 
 * Time Complexity:
 * - Forward Elimination: O(n^3 / 3) multiplications and subtractions.
 * - Back Substitution: O(n^2 / 2) operations.
 * - Total: O(n^3) time, O(n^2) space for matrix copy.
 * 
 * Limitations:
 * Row partial pivoting guarantees multiplier magnitude |m_ik| <= 1, bounding round-off growth
 * in well-scaled matrices. However, it does not cure intrinsic ill-conditioning (where condition
 * number kappa(A) approaches 1 / epsilon_mach).
 * 
 * @param {number[][]} A - Square n x n coefficient matrix
 * @param {number[]} b - Right-hand side vector of length n
 * @param {object} [options]
 * @param {number} [options.relativeTolerance=DEFAULT_RELATIVE_TOLERANCE] - Pivot tolerance
 * @returns {number[]} Solution vector x of length n
 * @throws {DimensionMismatchError} If matrix is non-square or dimensions mismatch
 * @throws {NonFiniteValueError} If inputs or intermediate computations contain NaN or Infinity
 * @throws {SingularMatrixError} If matrix is singular or pivot falls below tolerance
 */
/**
 * Internal core implementation of Gaussian elimination with row partial pivoting.
 * Used by both solveLinearSystem and solveLinearSystemWithTrace.
 * 
 * @param {number[][]} A 
 * @param {number[]} b 
 * @param {object} options 
 * @param {boolean} recordTrace 
 * @returns {{ solution: number[], residual: number[], residualNorm: number, steps?: Array<object> }}
 */
function _gaussianElimination(A, b, options = {}, recordTrace = false) {
  const relTol = typeof options.relativeTolerance === 'number' 
    ? options.relativeTolerance 
    : DEFAULT_RELATIVE_TOLERANCE;

  // 1. Dimension Validation
  if (!Array.isArray(A) || A.length === 0 || !Array.isArray(b)) {
    throw new DimensionMismatchError("Coefficient matrix A and vector b must be non-empty arrays.");
  }

  const n = A.length;
  if (b.length !== n) {
    throw new DimensionMismatchError(`Dimension mismatch: Matrix A has ${n} rows but vector b has length ${b.length}.`);
  }

  for (let i = 0; i < n; i++) {
    if (!Array.isArray(A[i]) || A[i].length !== n) {
      throw new DimensionMismatchError(`Matrix A must be square (n x n). Row ${i} has length ${A[i]?.length || 0}, expected ${n}.`);
    }
  }

  // 2. Non-Finite Input Validation
  if (!isAllFinite(b)) {
    throw new NonFiniteValueError("Vector b contains non-finite values (NaN or Infinity).");
  }
  for (let i = 0; i < n; i++) {
    if (!isAllFinite(A[i])) {
      throw new NonFiniteValueError(`Matrix A contains non-finite values (NaN or Infinity) at row ${i}.`);
    }
  }

  // 3. Deep copy to guarantee caller immutability
  const M = cloneMatrix(A);
  const rhs = cloneVector(b);

  // Determine overall matrix magnitude (infinity-like max entry norm)
  const matrixScale = getSubmatrixScale(M, 0);
  if (matrixScale === 0) {
    throw new SingularMatrixError("Coefficient matrix A is an all-zero matrix (rank 0).");
  }

  const steps = [];
  if (recordTrace) {
    steps.push({
      stage: 'initial',
      stepIndex: 0,
      title: 'Initial Augmented System [A | b]',
      description: `Starting linear system with dimension ${n}x${n}. Submatrix scale s_scale = ${matrixScale.toExponential(4)}.`,
      matrix: cloneMatrix(M),
      rhs: cloneVector(rhs),
      n
    });
  }

  // 4. Forward Elimination with Row Partial Pivoting
  for (let k = 0; k < n - 1; k++) {
    const subScale = getSubmatrixScale(M, k);

    // Find pivot row with maximum absolute entry in column k
    let pivotRow = k;
    let maxPivotVal = Math.abs(M[k][k]);

    for (let i = k + 1; i < n; i++) {
      const absVal = Math.abs(M[i][k]);
      if (absVal > maxPivotVal) {
        maxPivotVal = absVal;
        pivotRow = i;
      }
    }

    if (recordTrace) {
      steps.push({
        stage: 'pivot_selection',
        stepIndex: steps.length,
        k,
        pivotCol: k,
        pivotRow,
        maxPivotVal,
        pivotVal: M[pivotRow][k],
        submatrixScale: subScale,
        tolerance: relTol * matrixScale,
        requiresSwap: pivotRow !== k,
        title: `Stage ${k + 1}: Pivot Selection (Column ${k + 1})`,
        description: `Max absolute pivot in column ${k + 1} is |a_{${pivotRow + 1},${k + 1}}| = ${maxPivotVal.toExponential(4)} (Row ${pivotRow + 1}). Requires swap: ${pivotRow !== k ? 'Yes' : 'No'}.`,
        matrix: cloneMatrix(M),
        rhs: cloneVector(rhs)
      });
    }

    // Scale-aware relative pivot tolerance validation against overall matrix scale
    if (maxPivotVal < relTol * matrixScale) {
      const err = new SingularMatrixError(
        `Pivot at column ${k} (${maxPivotVal.toExponential(4)}) is below scale-aware tolerance (${(relTol * matrixScale).toExponential(4)}). Matrix is singular or ill-conditioned.`
      );
      if (recordTrace) {
        steps.push({
          stage: 'error',
          stepIndex: steps.length,
          title: `Singularity Detected at Column ${k + 1}`,
          description: err.message,
          matrix: cloneMatrix(M),
          rhs: cloneVector(rhs),
          error: err.message
        });
      }
      throw err;
    }

    // Swap pivot row if necessary
    if (pivotRow !== k) {
      const tempRow = M[k];
      M[k] = M[pivotRow];
      M[pivotRow] = tempRow;

      const tempRhs = rhs[k];
      rhs[k] = rhs[pivotRow];
      rhs[pivotRow] = tempRhs;

      if (recordTrace) {
        steps.push({
          stage: 'row_swap',
          stepIndex: steps.length,
          k,
          row1: k,
          row2: pivotRow,
          title: `Stage ${k + 1}: Row Swap (R${k + 1} ↔ R${pivotRow + 1})`,
          description: `Swapped row ${k + 1} with pivot row ${pivotRow + 1} to maximize diagonal pivot magnitude.`,
          matrix: cloneMatrix(M),
          rhs: cloneVector(rhs)
        });
      }
    }

    // Eliminate entries below pivot
    const pivot = M[k][k];
    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k] / pivot;
      if (!Number.isFinite(factor)) {
        throw new NonFiniteValueError(`Non-finite elimination factor produced at row ${i}, col ${k}.`);
      }

      const originalRowEntry = M[i][k];
      M[i][k] = 0; // Exactly zero out eliminated entry
      for (let j = k + 1; j < n; j++) {
        M[i][j] -= factor * M[k][j];
        if (!Number.isFinite(M[i][j])) {
          throw new NonFiniteValueError(`Non-finite intermediate value produced at M[${i}][${j}].`);
        }
      }

      rhs[i] -= factor * rhs[k];
      if (!Number.isFinite(rhs[i])) {
        throw new NonFiniteValueError(`Non-finite intermediate value produced in RHS at index ${i}.`);
      }

      if (recordTrace) {
        const factorStr = factor >= 0 ? factor.toFixed(4) : `(${factor.toFixed(4)})`;
        steps.push({
          stage: 'elimination_row',
          stepIndex: steps.length,
          k,
          targetRow: i,
          pivotRow: k,
          multiplier: factor,
          originalEntry: originalRowEntry,
          title: `Stage ${k + 1}: Eliminate Row ${i + 1}`,
          description: `Multiplier m_{${i + 1},${k + 1}} = ${originalRowEntry.toFixed(4)} / ${pivot.toFixed(4)} = ${factor.toFixed(4)}. Operation: R${i + 1} ← R${i + 1} - (${factorStr}) · R${k + 1}.`,
          matrix: cloneMatrix(M),
          rhs: cloneVector(rhs)
        });
      }
    }
  }

  // 5. Final Diagonal Pivot Check against matrix scale
  const lastPivot = Math.abs(M[n - 1][n - 1]);
  if (lastPivot === 0 || lastPivot < relTol * matrixScale) {
    const err = new SingularMatrixError(
      `Final diagonal pivot (${lastPivot.toExponential(4)}) is below scale-aware tolerance (${(relTol * matrixScale).toExponential(4)}). Matrix is singular or ill-conditioned.`
    );
    if (recordTrace) {
      steps.push({
        stage: 'error',
        stepIndex: steps.length,
        title: 'Singularity Detected at Final Pivot',
        description: err.message,
        matrix: cloneMatrix(M),
        rhs: cloneVector(rhs),
        error: err.message
      });
    }
    throw err;
  }

  if (recordTrace) {
    steps.push({
      stage: 'upper_triangular',
      stepIndex: steps.length,
      title: 'Forward Elimination Complete (Upper Triangular System U | c)',
      description: `Matrix successfully transformed into upper-triangular echelon form. Final diagonal pivot |U_{${n},${n}}| = ${lastPivot.toExponential(4)}.`,
      matrix: cloneMatrix(M),
      rhs: cloneVector(rhs)
    });
  }

  // 6. Back Substitution
  const x = new Array(n);
  const backSubSteps = [];

  // Terminal variable x_{n-1}
  x[n - 1] = rhs[n - 1] / M[n - 1][n - 1];
  if (!Number.isFinite(x[n - 1])) {
    throw new NonFiniteValueError("Non-finite value computed during back substitution at terminal pivot.");
  }
  if (recordTrace) {
    const subInfo = {
      index: n - 1,
      variable: `x_${n}`,
      formula: `x_${n} = c_${n} / U_{${n},${n}}`,
      calculation: `${rhs[n - 1].toFixed(4)} / ${M[n - 1][n - 1].toFixed(4)}`,
      value: x[n - 1]
    };
    backSubSteps.push(subInfo);
    steps.push({
      stage: 'back_substitution_step',
      stepIndex: steps.length,
      varIndex: n - 1,
      title: `Back Substitution: Solve for x_${n}`,
      description: `${subInfo.formula} = ${subInfo.calculation} = ${x[n - 1].toFixed(6)}`,
      backSubStep: subInfo,
      currentX: [...x]
    });
  }

  // Remaining variables from n-2 down to 0
  for (let i = n - 2; i >= 0; i--) {
    let sum = 0;
    const termStrings = [];
    for (let j = i + 1; j < n; j++) {
      sum += M[i][j] * x[j];
      termStrings.push(`(${M[i][j].toFixed(4)} · ${x[j].toFixed(4)})`);
    }
    x[i] = (rhs[i] - sum) / M[i][i];
    if (!Number.isFinite(x[i])) {
      throw new NonFiniteValueError(`Non-finite solution value computed during back substitution at index ${i}.`);
    }

    if (recordTrace) {
      const sumTerms = termStrings.length > 0 ? termStrings.join(' + ') : '0';
      const subInfo = {
        index: i,
        variable: `x_${i + 1}`,
        formula: `x_${i + 1} = (c_${i + 1} - Σ U_{${i + 1},j} x_j) / U_{${i + 1},${i + 1}}`,
        calculation: `(${rhs[i].toFixed(4)} - [${sumTerms}]) / ${M[i][i].toFixed(4)}`,
        partialSum: sum,
        value: x[i]
      };
      backSubSteps.push(subInfo);
      steps.push({
        stage: 'back_substitution_step',
        stepIndex: steps.length,
        varIndex: i,
        title: `Back Substitution: Solve for x_${i + 1}`,
        description: `${subInfo.formula} = ${subInfo.calculation} = ${x[i].toFixed(6)}`,
        backSubStep: subInfo,
        currentX: [...x]
      });
    }
  }

  // 7. Residual Vector Calculation: r = b - A * x
  const residual = new Array(n);
  let sumSqResid = 0;
  for (let i = 0; i < n; i++) {
    let ax_i = 0;
    for (let j = 0; j < n; j++) {
      ax_i += A[i][j] * x[j];
    }
    const r_i = b[i] - ax_i;
    residual[i] = r_i;
    sumSqResid += r_i * r_i;
  }
  const residualNorm = Math.sqrt(sumSqResid);

  if (recordTrace) {
    steps.push({
      stage: 'complete',
      stepIndex: steps.length,
      title: 'Solution Vector & Residual Calculation Complete',
      description: `System solved. Solution x = [${x.map(v => v.toFixed(6)).join(', ')}]. Euclidean residual norm ||r||_2 = ||b - Ax||_2 = ${residualNorm.toExponential(4)}.`,
      solution: [...x],
      residual: [...residual],
      residualNorm,
      matrix: cloneMatrix(M),
      rhs: cloneVector(rhs)
    });
  }

  return {
    solution: x,
    residual,
    residualNorm,
    steps: recordTrace ? steps : undefined
  };
}

/**
 * Solves the linear system A * x = b using Gaussian elimination with row partial pivoting.
 * 
 * @param {number[][]} A - Square n x n coefficient matrix
 * @param {number[]} b - Right-hand side vector of length n
 * @param {object} [options]
 * @param {number} [options.relativeTolerance=DEFAULT_RELATIVE_TOLERANCE] - Pivot tolerance
 * @returns {number[]} Solution vector x of length n
 */
export function solveLinearSystem(A, b, options = {}) {
  const result = _gaussianElimination(A, b, options, false);
  return result.solution;
}

/**
 * Solves the linear system A * x = b with full educational step-by-step trace generation.
 * Records all intermediate matrix states, pivot choices, row swaps, elimination multipliers,
 * back-substitution steps, and residual norm ||b - Ax||_2.
 * 
 * @param {number[][]} A - Square n x n coefficient matrix
 * @param {number[]} b - Right-hand side vector of length n
 * @param {object} [options]
 * @param {number} [options.relativeTolerance=DEFAULT_RELATIVE_TOLERANCE] - Pivot tolerance
 * @returns {{ solution: number[], residual: number[], residualNorm: number, steps: Array<object> }}
 */
export function solveLinearSystemWithTrace(A, b, options = {}) {
  return _gaussianElimination(A, b, options, true);
}

