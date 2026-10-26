/**
 * @file math_utils.js
 * @description Foundational numerical linear algebra and statistical utilities for Gradivue.
 * Pure mathematical functions decoupled from DOM and browser APIs.
 * Document Reference: docs/NUMERICAL_MODEL.md
 */

export const EPSILON_MACH = Number.EPSILON || 2.220446049250313e-16;
export const VARIANCE_THRESHOLD = 1e-12;
export const RELATIVE_PIVOT_TOLERANCE = 1e-14;

/**
 * Validates that all elements in an array or scalar are finite numbers.
 * @param {number|number[]} val 
 * @returns {boolean} True if all values are finite, false otherwise.
 */
export function isAllFinite(val) {
  if (Array.isArray(val)) {
    return val.every(v => typeof v === 'number' && Number.isFinite(v));
  }
  return typeof val === 'number' && Number.isFinite(val);
}

/**
 * Computes the arithmetic mean of a 1D numeric array.
 * @param {number[]} arr 
 * @returns {number}
 */
export function mean(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("Cannot compute mean of empty or invalid array.");
  }
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

/**
 * Computes sample variance of an array: s^2 = (1/M) * sum((x_i - mean)^2).
 * @param {number[]} arr 
 * @returns {number}
 */
export function variance(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("Cannot compute variance of empty or invalid array.");
  }
  const m = mean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) {
    const diff = arr[i] - m;
    sumSq += diff * diff;
  }
  return sumSq / arr.length;
}

/**
 * Checks if an input array has near-zero variance (indicating collinearity with intercept).
 * @param {number[]} arr 
 * @param {number} [threshold=VARIANCE_THRESHOLD]
 * @returns {boolean} True if variance < threshold (degenerate / near singular).
 */
export function hasNearZeroVariance(arr, threshold = VARIANCE_THRESHOLD) {
  return variance(arr) < threshold;
}

/**
 * Centers a 1D array by subtracting its mean: x'_i = x_i - mean(x).
 * Centering decouples the intercept from the slope in Normal Equations.
 * @param {number[]} arr 
 * @returns {{ centered: number[], mean: number }}
 */
export function center(arr) {
  const m = mean(arr);
  const centered = arr.map(x => x - m);
  return { centered, mean: m };
}

/**
 * Computes the dot product of two equal-length vectors.
 * @param {number[]} u 
 * @param {number[]} v 
 * @returns {number}
 */
export function dot(u, v) {
  if (!Array.isArray(u) || !Array.isArray(v) || u.length !== v.length) {
    throw new Error("Vectors must be non-empty arrays of identical length.");
  }
  let sum = 0;
  for (let i = 0; i < u.length; i++) {
    sum += u[i] * v[i];
  }
  return sum;
}

/**
 * Computes the maximum absolute element in a submatrix starting from row/col k.
 * Used for scale-aware pivot validation.
 * @param {number[][]} A - 2D matrix
 * @param {number} k - Start row and column index (0-based)
 * @returns {number} Maximum absolute value in active submatrix
 */
export function getSubmatrixScale(A, k = 0) {
  let maxVal = 0;
  const numRows = A.length;
  for (let i = k; i < numRows; i++) {
    const row = A[i];
    const numCols = row.length;
    for (let j = k; j < numCols; j++) {
      const absVal = Math.abs(row[j]);
      if (absVal > maxVal) {
        maxVal = absVal;
      }
    }
  }
  return maxVal;
}

/**
 * Transposes an M x N 2D matrix into an N x M matrix.
 * @param {number[][]} A 
 * @returns {number[][]}
 */
export function transpose(A) {
  if (!Array.isArray(A) || A.length === 0 || !Array.isArray(A[0])) {
    throw new Error("Invalid 2D matrix for transpose.");
  }
  const rows = A.length;
  const cols = A[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = A[i][j];
    }
  }
  return result;
}

/**
 * Computes the determinant of a 2x2 matrix and reports its scale.
 * Note: Determinant is scale-dependent (det(cA) = c^2 * det(A)).
 * @param {number[][]} A 
 * @returns {{ det: number, scale: number, normalizedDet: number }}
 */
export function det2x2WithScale(A) {
  if (A.length !== 2 || A[0].length !== 2 || A[1].length !== 2) {
    throw new Error("Matrix must be 2x2.");
  }
  const a = A[0][0], b = A[0][1];
  const c = A[1][0], d = A[1][1];
  const det = a * d - b * c;
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
  const normalizedDet = scale > 0 ? det / (scale * scale) : 0;
  return { det, scale, normalizedDet };
}
