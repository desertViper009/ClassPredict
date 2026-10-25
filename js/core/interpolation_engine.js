/**
 * @file interpolation_engine.js
 * @description Educational Newton Divided-Difference Polynomial Interpolation module.
 * Demonstrates exact polynomial interpolation across known nodes vs. extrapolation instability.
 * Pure mathematical core decoupled from the DOM.
 * Document Reference: docs/NUMERICAL_MODEL.md, docs/REQUIREMENTS.md (FR-07)
 */

import { isAllFinite } from './math_utils.js';

export const EPSILON_NODE_TOLERANCE = 1e-12;

/**
 * Computes the Newton divided-difference table and polynomial coefficients.
 * 
 * Mathematical Formulation:
 * Given n + 1 points (x_0, y_0), (x_1, y_1), ..., (x_n, y_n):
 * f[x_i] = y_i
 * f[x_i, ..., x_{i+k}] = (f[x_{i+1}, ..., x_{i+k}] - f[x_i, ..., x_{i+k-1}]) / (x_{i+k} - x_i)
 * 
 * Polynomial Form:
 * P_n(x) = c_0 + c_1*(x - x_0) + c_2*(x - x_0)*(x - x_1) + ... + c_n*prod_{j=0}^{n-1}(x - x_j)
 * where c_i = f[x_0, x_1, ..., x_i].
 * 
 * Academic Notice:
 * Newton interpolation is designed strictly for intra-domain reconstruction (interpolation).
 * It is mathematically invalid as a production forecaster for future semesters due to
 * Runge's phenomenon and extreme polynomial oscillation outside the data hull.
 * 
 * @param {number[]} x - Node x-coordinates (e.g. semester numbers)
 * @param {number[]} y - Node y-coordinates (e.g. observed SGPA values)
 * @returns {{ coefficients: number[], table: number[][], xNodes: number[] }}
 */
export function computeDividedDifferences(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y)) {
    throw new Error("Inputs x and y must be arrays.");
  }

  if (x.length !== y.length) {
    throw new Error(`Dimension mismatch: x has length ${x.length}, but y has length ${y.length}.`);
  }

  const n = x.length;
  if (n === 0) {
    throw new Error("Cannot interpolate on empty data arrays.");
  }

  if (!isAllFinite(x) || !isAllFinite(y)) {
    throw new Error("Inputs contain non-finite numbers (NaN or Infinity).");
  }

  // Deep copy nodes to preserve caller immutability
  const xNodes = [...x];
  const yNodes = [...y];

  // Validate distinct x nodes (reject duplicates to prevent divide-by-zero)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(xNodes[i] - xNodes[j]) < EPSILON_NODE_TOLERANCE) {
        throw new Error(
          `Duplicate or near-identical interpolation node detected at indices ${i} and ${j} (x = ${xNodes[i]}). Divided differences require distinct x values.`
        );
      }
    }
  }

  // Allocate 2D divided-difference table of size n x n
  // table[i][j] represents f[x_i, x_{i+1}, ..., x_{i+j}]
  const table = Array.from({ length: n }, () => new Array(n).fill(0));

  // Order 0: f[x_i] = y_i
  for (let i = 0; i < n; i++) {
    table[i][0] = yNodes[i];
  }

  // Higher orders: j = 1 to n - 1
  for (let j = 1; j < n; j++) {
    for (let i = 0; i < n - j; i++) {
      const numerator = table[i + 1][j - 1] - table[i][j - 1];
      const denominator = xNodes[i + j] - xNodes[i];
      table[i][j] = numerator / denominator;

      if (!Number.isFinite(table[i][j])) {
        throw new Error(`Non-finite divided difference generated at order ${j}, row ${i}.`);
      }
    }
  }

  // Polynomial coefficients are the top row: c_j = table[0][j]
  const coefficients = new Array(n);
  for (let j = 0; j < n; j++) {
    coefficients[j] = table[0][j];
  }

  return {
    coefficients,
    table,
    xNodes
  };
}

/**
 * Evaluates the Newton interpolating polynomial at a query point xTarget using nested multiplication (Horner's-like form).
 * 
 * P_n(x) = c_0 + (x - x_0) * (c_1 + (x - x_1) * (c_2 + ... + (x - x_{n-1}) * c_n))
 * 
 * @param {number[]} coefficients - Newton divided-difference coefficients c_0 ... c_n
 * @param {number[]} xNodes - The x node coordinates x_0 ... x_n
 * @param {number} xTarget - Target evaluation coordinate
 * @returns {number} Evaluated polynomial value P_n(xTarget)
 */
export function evaluateNewtonPolynomial(coefficients, xNodes, xTarget) {
  if (!Array.isArray(coefficients) || !Array.isArray(xNodes)) {
    throw new Error("Coefficients and xNodes must be arrays.");
  }

  const n = coefficients.length;
  if (n === 0 || xNodes.length !== n) {
    throw new Error(`Incompatible lengths: coefficients (${n}) and xNodes (${xNodes.length}).`);
  }

  if (typeof xTarget !== 'number' || !Number.isFinite(xTarget)) {
    throw new Error("Target evaluation coordinate xTarget must be a finite number.");
  }

  // Horner's-like nested backward multiplication
  let result = coefficients[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    result = coefficients[i] + (xTarget - xNodes[i]) * result;
    if (!Number.isFinite(result)) {
      throw new Error(`Non-finite intermediate value during Newton evaluation at order ${i}.`);
    }
  }

  return result;
}

/**
 * Creates an educational Newton interpolator model object.
 * 
 * @param {number[]} x 
 * @param {number[]} y 
 * @returns {object}
 */
export function fitNewtonInterpolation(x, y) {
  const { coefficients, table, xNodes } = computeDividedDifferences(x, y);

  return {
    modelId: "MODEL_NEWTON_INTERPOLATION",
    modelName: "Newton Divided-Difference Interpolation",
    degree: xNodes.length - 1,
    coefficients: [...coefficients],
    table: table.map(row => [...row]),
    xNodes: [...xNodes],
    domain: {
      min: Math.min(...xNodes),
      max: Math.max(...xNodes)
    },

    /**
     * Evaluates the polynomial at xVal.
     * Flags when extrapolation is performed beyond the interpolation domain.
     * 
     * @param {number} xVal 
     * @returns {{ value: number, isExtrapolation: boolean, x: number }}
     */
    evaluate: function(xVal) {
      const value = evaluateNewtonPolynomial(coefficients, xNodes, xVal);
      const isExtrapolation = xVal < this.domain.min || xVal > this.domain.max;

      return {
        value,
        isExtrapolation,
        x: xVal
      };
    }
  };
}
