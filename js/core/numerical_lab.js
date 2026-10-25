/**
 * @file numerical_lab.js
 * @description Educational Numerical Methods Laboratory calculation engine for ClassPredict.
 * Implements step-by-step Gaussian elimination traces, linear vs. quadratic regression
 * comparison, Newton divided-difference term breakdown, and Runge's phenomenon demonstrations.
 * Pure mathematical core decoupled from the DOM.
 * Document Reference: docs/NUMERICAL_MODEL.md, docs/REQUIREMENTS.md (FR-07)
 */

import { mean, variance, isAllFinite } from './math_utils.js';
import { 
  solveLinearSystem, 
  solveLinearSystemWithTrace, 
  SingularMatrixError, 
  DimensionMismatchError, 
  NonFiniteValueError 
} from './linear_algebra.js';
import { fitLinearRegression } from './regression_engine.js';
import { 
  computeDividedDifferences, 
  evaluateNewtonPolynomial 
} from './interpolation_engine.js';

/* ==========================================================================
   EXPERIMENT A: Gaussian Elimination with Row Partial Pivoting
   ========================================================================== */

/**
 * Built-in illustrative linear systems for educational demonstration.
 */
export const GAUSSIAN_EXAMPLES = {
  standard_3x3: {
    id: 'standard_3x3',
    name: 'Standard Well-Conditioned (3×3)',
    description: 'Well-conditioned system with integer solution [1, 2, 3]. Demonstrates standard row operations.',
    A: [
      [1, 2, 3],
      [2, 5, 2],
      [3, 1, 5]
    ],
    b: [14, 18, 20],
    expectedSolution: [1, 2, 3]
  },
  row_swap_2x2: {
    id: 'row_swap_2x2',
    name: 'Zero Pivot Row Swap (2×2)',
    description: 'Zero in A[0][0] mandates row swap under partial pivoting to avoid divide-by-zero.',
    A: [
      [0, 2],
      [3, 1]
    ],
    b: [4, 7],
    expectedSolution: [5 / 3, 2]
  },
  near_singular_3x3: {
    id: 'near_singular_3x3',
    name: 'Ill-Conditioned Near-Collinear (3×3)',
    description: 'Rows 1 and 2 are nearly proportional, producing small pivots and large condition number.',
    A: [
      [1, 2, 3],
      [2, 4.0001, 6.0001],
      [1, 1, 1]
    ],
    b: [6, 12.0003, 3],
    expectedSolution: [1, 1, 1]
  },
  singular_3x3: {
    id: 'singular_3x3',
    name: 'Analytically Singular (3×3)',
    description: 'Row 2 is exactly 2× Row 1. Fails scale-aware relative pivot tolerance.',
    A: [
      [1, 2, 3],
      [2, 4, 6],
      [3, 1, 4]
    ],
    b: [6, 12, 8],
    expectedSolution: null
  }
};

/**
 * Runs a Gaussian Elimination educational experiment with full step-by-step tracing.
 * 
 * @param {number[][]} A - Square coefficient matrix
 * @param {number[]} b - RHS vector
 * @param {object} [options]
 * @returns {object} Full experiment report including steps, solution, and residual
 */
export function runGaussianEliminationExperiment(A, b, options = {}) {
  // Input validation
  if (!Array.isArray(A) || !Array.isArray(b)) {
    throw new DimensionMismatchError("Coefficient matrix A and RHS vector b must be arrays.");
  }

  const n = A.length;
  if (n < 2 || n > 5) {
    throw new DimensionMismatchError(`Educational laboratory supports matrix dimensions between 2x2 and 5x5 (received ${n}x${n}).`);
  }

  if (b.length !== n) {
    throw new DimensionMismatchError(`Dimension mismatch: Matrix has ${n} rows but vector b has length ${b.length}.`);
  }

  for (let i = 0; i < n; i++) {
    if (!Array.isArray(A[i]) || A[i].length !== n) {
      throw new DimensionMismatchError(`Matrix must be square (${n}x${n}). Row ${i} has length ${A[i]?.length || 0}.`);
    }
  }

  // Execute solver with trace
  try {
    const traceResult = solveLinearSystemWithTrace(A, b, options);
    return {
      success: true,
      dimension: n,
      solution: traceResult.solution,
      residual: traceResult.residual,
      residualNorm: traceResult.residualNorm,
      steps: traceResult.steps,
      totalSteps: traceResult.steps.length,
      error: null
    };
  } catch (err) {
    return {
      success: false,
      dimension: n,
      solution: null,
      residual: null,
      residualNorm: null,
      steps: [],
      totalSteps: 0,
      error: err.message
    };
  }
}

/* ==========================================================================
   EXPERIMENT B: Linear vs. Quadratic Least-Squares Regression
   ========================================================================== */

/**
 * Built-in synthetic datasets for linear vs. quadratic regression laboratory.
 */
export const REGRESSION_LAB_DATASETS = {
  linear_trend: {
    id: 'linear_trend',
    name: 'Linear Trend with Mild Scatter',
    description: 'Deterministic synthetic academic transition dataset following a linear relationship with small disturbance.',
    isSynthetic: true,
    x: [2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75],
    y: [2.15, 2.30, 2.60, 2.70, 3.10, 3.20, 3.55, 3.70]
  },
  parabolic_dip_recovery: {
    id: 'parabolic_dip_recovery',
    name: 'Nonlinear Dip and Recovery',
    description: 'Deterministic synthetic dataset illustrating a curriculum hurdle and subsequent academic recovery.',
    isSynthetic: true,
    x: [1.80, 2.20, 2.50, 2.80, 3.20, 3.50, 3.80],
    y: [2.80, 2.10, 1.95, 2.20, 2.75, 3.30, 3.85]
  },
  diminishing_plateau: {
    id: 'diminishing_plateau',
    name: 'Diminishing Returns (Ceiling Plateau)',
    description: 'Deterministic synthetic dataset where grade gains level off as SGPA approaches the 4.00 ceiling.',
    isSynthetic: true,
    x: [2.00, 2.40, 2.80, 3.10, 3.40, 3.70, 3.90],
    y: [2.50, 2.95, 3.35, 3.60, 3.78, 3.88, 3.92]
  }
};

/**
 * Fits both Linear and Quadratic least-squares models to the same observations.
 * 
 * Mathematical Formulations:
 * Linear:    y = a0 + a1*x
 * Quadratic: y = a0 + a1*x + a2*x^2
 * 
 * Predictor Centering Strategy:
 * Quadratic normal equations suffer from condition squaring: kappa_2(X^T X) = (kappa_2(X))^2.
 * Predictors are centered: x' = x - mean(x).
 * Model in centered coordinates: y = c0 + c1*x' + c2*(x')^2.
 * 
 * Uncentering back to original coordinates x:
 * y = c0 + c1*(x - mean(x)) + c2*(x - mean(x))^2
 *   = (c0 - c1*mean(x) + c2*(mean(x))^2) + (c1 - 2*c2*mean(x))*x + c2*x^2
 * 
 * a2 = c2
 * a1 = c1 - 2 * c2 * mean(x)
 * a0 = c0 - c1 * mean(x) + c2 * (mean(x))^2
 * 
 * @param {number[]} x - Predictor coordinates
 * @param {number[]} y - Response coordinates
 * @param {object} [options]
 * @returns {object} Comparative regression analysis
 */
export function fitLinearAndQuadraticRegression(x, y, options = {}) {
  if (!Array.isArray(x) || !Array.isArray(y)) {
    throw new Error("Inputs x and y must be arrays.");
  }

  if (x.length !== y.length) {
    throw new Error(`Dimension mismatch: x has ${x.length} observations, but y has ${y.length}.`);
  }

  const n = x.length;
  if (n < 3) {
    throw new Error(`Comparative polynomial regression requires at least 3 data points (found ${n}).`);
  }

  if (!isAllFinite(x) || !isAllFinite(y)) {
    throw new Error("Inputs contain non-finite numbers (NaN or Infinity).");
  }

  // Work on immutable copies
  const xCopy = [...x];
  const yCopy = [...y];

  const meanX = mean(xCopy);
  const meanY = mean(yCopy);
  const varX = variance(xCopy);

  if (varX < 1e-12) {
    throw new Error(`Predictor variance (${varX.toExponential(4)}) is near zero. System is rank-deficient.`);
  }

  // 1. Fit Linear Model using existing production solver
  const linearFit = fitLinearRegression(xCopy, yCopy, {
    scaleMax: options.scaleMax != null ? options.scaleMax : 1e9,
    scaleMaxX: options.scaleMaxX != null ? options.scaleMaxX : 1e9,
    scaleMaxY: options.scaleMaxY != null ? options.scaleMaxY : 1e9,
    minVariance: options.minVariance || 1e-12
  });

  const a1_lin = linearFit.coefficients.b; // slope
  const a0_lin = linearFit.coefficients.a; // intercept

  // Compute Linear Residuals and RSS
  const linearResiduals = [];
  let linearRss = 0;
  for (let i = 0; i < n; i++) {
    const yHat = a0_lin + a1_lin * xCopy[i];
    const res = yCopy[i] - yHat;
    linearResiduals.push(res);
    linearRss += res * res;
  }

  // 2. Fit Quadratic Model via Centered Normal Equations
  // Centered predictor u_i = x_i - meanX
  const u = xCopy.map(val => val - meanX);

  // Accumulate Normal Equation sums for centered quadratic basis [1, u, u^2]
  let sumU = 0; // identically 0 by construction
  let sumU2 = 0;
  let sumU3 = 0;
  let sumU4 = 0;

  let sumY = 0;
  let sumUY = 0;
  let sumU2Y = 0;

  for (let i = 0; i < n; i++) {
    const ui = u[i];
    const u2 = ui * ui;
    const u3 = u2 * ui;
    const u4 = u2 * u2;
    const yi = yCopy[i];

    sumU += ui;
    sumU2 += u2;
    sumU3 += u3;
    sumU4 += u4;

    sumY += yi;
    sumUY += ui * yi;
    sumU2Y += u2 * yi;
  }

  // Form Centered 3x3 Normal Equations: (X'^T X') * c = X'^T y
  const XtX_centered = [
    [n, sumU, sumU2],
    [sumU, sumU2, sumU3],
    [sumU2, sumU3, sumU4]
  ];
  const Xty_centered = [sumY, sumUY, sumU2Y];

  // Solve for centered coefficients c = [c0, c1, c2]
  const c = solveLinearSystem(XtX_centered, Xty_centered);
  const c0 = c[0];
  const c1 = c[1];
  const c2 = c[2];

  // Uncenter back to standard polynomial form: y = a0 + a1*x + a2*x^2
  const a2_quad = c2;
  const a1_quad = c1 - 2 * c2 * meanX;
  const a0_quad = c0 - c1 * meanX + c2 * meanX * meanX;

  // Compute Quadratic Residuals and RSS
  const quadResiduals = [];
  let quadRss = 0;
  for (let i = 0; i < n; i++) {
    const xi = xCopy[i];
    const yHat = a0_quad + a1_quad * xi + a2_quad * xi * xi;
    const res = yCopy[i] - yHat;
    quadResiduals.push(res);
    quadRss += res * res;
  }

  // Normal equations in uncentered standard coordinates for educational display
  let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
  let sumXY = 0, sumX2Y = 0;
  for (let i = 0; i < n; i++) {
    const xi = xCopy[i];
    const x2 = xi * xi;
    sumX += xi;
    sumX2 += x2;
    sumX3 += x2 * xi;
    sumX4 += x2 * x2;
    sumXY += xi * yCopy[i];
    sumX2Y += x2 * yCopy[i];
  }

  const normalEquationsUncentered = {
    A: [
      [n, sumX, sumX2],
      [sumX, sumX2, sumX3],
      [sumX2, sumX3, sumX4]
    ],
    b: [sumY, sumXY, sumX2Y]
  };

  // Residual comparison
  const residualComparison = [];
  for (let i = 0; i < n; i++) {
    residualComparison.push({
      index: i,
      x: xCopy[i],
      y: yCopy[i],
      linearFitted: a0_lin + a1_lin * xCopy[i],
      linearResidual: linearResiduals[i],
      quadraticFitted: a0_quad + a1_quad * xCopy[i] + a2_quad * xCopy[i] * xCopy[i],
      quadraticResidual: quadResiduals[i]
    });
  }

  return {
    observationCount: n,
    observations: xCopy.map((val, idx) => ({ x: val, y: yCopy[idx] })),
    linearModel: {
      degree: 1,
      coefficients: { a0: a0_lin, a1: a1_lin },
      formula: `y = ${a0_lin.toFixed(4)} + ${a1_lin.toFixed(4)}x`,
      rss: linearRss,
      mse: linearRss / n,
      residuals: linearResiduals,
      predict: (xVal) => a0_lin + a1_lin * xVal
    },
    quadraticModel: {
      degree: 2,
      coefficients: { a0: a0_quad, a1: a1_quad, a2: a2_quad },
      centeredCoefficients: { c0, c1, c2 },
      predictorMean: meanX,
      formula: `y = ${a0_quad.toFixed(4)} + ${a1_quad.toFixed(4)}x + ${a2_quad.toFixed(4)}x²`,
      rss: quadRss,
      mse: quadRss / n,
      residuals: quadResiduals,
      predict: (xVal) => a0_quad + a1_quad * xVal + a2_quad * xVal * xVal
    },
    normalEquations: {
      centered: { A: XtX_centered, b: Xty_centered },
      uncentered: normalEquationsUncentered
    },
    residualComparison,
    rssImprovementPercent: linearRss > 0 ? ((linearRss - quadRss) / linearRss) * 100 : 0,
    academicWarning: "A lower in-sample Residual Sum of Squares (RSS) does NOT guarantee better future predictive performance. Higher-degree polynomials possess greater parameter flexibility and can easily overfit small academic samples."
  };
}

/**
 * Extracts anonymous transition coordinates (s_t, s_{t+1}) from the accepted dataset
 * strictly for laboratory regression comparison.
 * 
 * @param {Array<object>} acceptedDataset 
 * @returns {{ x: number[], y: number[], count: number }}
 */
export function extractTransitionsForLab(acceptedDataset) {
  if (!Array.isArray(acceptedDataset) || acceptedDataset.length === 0) {
    return { x: [], y: [], count: 0 };
  }

  // Group by student key
  const studentMap = new Map();
  for (const r of acceptedDataset) {
    if (!r.student_key || r.semester_no == null || r.sgpa == null) continue;
    if (!studentMap.has(r.student_key)) {
      studentMap.set(r.student_key, []);
    }
    studentMap.get(r.student_key).push({
      semester_no: Number(r.semester_no),
      sgpa: Number(r.sgpa)
    });
  }

  const x = [];
  const y = [];

  studentMap.forEach(records => {
    records.sort((a, b) => a.semester_no - b.semester_no);
    for (let i = 0; i < records.length - 1; i++) {
      if (records[i + 1].semester_no - records[i].semester_no === 1) {
        x.push(records[i].sgpa);
        y.push(records[i + 1].sgpa);
      }
    }
  });

  return { x, y, count: x.length };
}

/* ==========================================================================
   EXPERIMENT C: Newton Divided-Difference Interpolation
   ========================================================================== */

/**
 * Built-in examples for Newton divided-difference interpolation laboratory.
 */
export const INTERPOLATION_EXAMPLES = {
  quadratic_3pt: {
    id: 'quadratic_3pt',
    name: 'Known Parabola (3 Points)',
    description: 'Distinct nodes x = [1, 2, 4], y = [1, 3, 13]. Reconstructs exact polynomial P(x) = x² - x + 1.',
    x: [1, 2, 4],
    y: [1, 3, 13],
    xEval: 3.0
  },
  student_trajectory_4pt: {
    id: 'student_trajectory_4pt',
    name: 'Student Semesters 1–4 Trajectory (4 Points)',
    description: 'Realistic academic semester history x = [1, 2, 3, 4], y = [3.10, 3.25, 3.40, 3.65].',
    x: [1, 2, 3, 4],
    y: [3.10, 3.25, 3.40, 3.65],
    xEval: 2.5
  },
  oscillating_5pt: {
    id: 'oscillating_5pt',
    name: 'Alternating Grades (5 Points)',
    description: 'Higher-degree alternating grades illustrating severe edge fluctuation outside the node hull.',
    x: [1, 2, 3, 4, 5],
    y: [3.50, 2.80, 3.70, 2.90, 3.80],
    xEval: 4.5
  }
};

/**
 * Runs a Newton Divided-Difference educational experiment.
 * Computes the divided-difference table and decomposes evaluation into term-by-term steps.
 * 
 * @param {number[]} x - Node x coordinates
 * @param {number[]} y - Node y coordinates
 * @param {number} xEval - Target evaluation coordinate
 * @returns {object} Interpolation experiment report
 */
export function runNewtonInterpolationExperiment(x, y, xEval) {
  if (!Array.isArray(x) || !Array.isArray(y)) {
    throw new Error("Nodes x and y must be arrays.");
  }

  if (x.length !== y.length) {
    throw new Error(`Dimension mismatch: x has ${x.length} nodes, but y has ${y.length} values.`);
  }

  const n = x.length;
  if (n < 2 || n > 6) {
    throw new Error(`Educational interpolation laboratory supports between 2 and 6 nodes (received ${n}).`);
  }

  if (typeof xEval !== 'number' || !Number.isFinite(xEval)) {
    throw new Error("Evaluation point xEval must be a finite number.");
  }

  // Compute table & coefficients using existing interpolation engine
  const { coefficients, table, xNodes } = computeDividedDifferences(x, y);

  // Term-by-term construction of P_n(xEval)
  // P_n(x) = c0 + c1*(x - x0) + c2*(x - x0)*(x - x1) + ...
  const terms = [];
  let currentBasisProduct = 1.0;
  let runningSum = 0.0;

  for (let k = 0; k < n; k++) {
    const ck = coefficients[k];
    const basisFactor = k === 0 ? 1.0 : currentBasisProduct;
    const termValue = ck * basisFactor;
    runningSum += termValue;

    let basisFormula = '';
    if (k === 0) {
      basisFormula = '1';
    } else {
      const parts = [];
      for (let j = 0; j < k; j++) {
        const xNodeStr = xNodes[j] >= 0 ? xNodes[j].toFixed(2) : `(${xNodes[j].toFixed(2)})`;
        parts.push(`(x - ${xNodeStr})`);
      }
      basisFormula = parts.join(' · ');
    }

    terms.push({
      order: k,
      coefficient: ck,
      basisFormula,
      basisValueAtEval: basisFactor,
      termValue,
      runningSum
    });

    // Update basis product for next iteration: multiply by (xEval - xNodes[k])
    currentBasisProduct *= (xEval - xNodes[k]);
  }

  // Exact evaluation via Horner's scheme
  const finalValue = evaluateNewtonPolynomial(coefficients, xNodes, xEval);

  // Domain and Extrapolation Assessment
  const minX = Math.min(...xNodes);
  const maxX = Math.max(...xNodes);
  const isExtrapolation = xEval < minX || xEval > maxX;
  const extrapolationDistance = isExtrapolation
    ? (xEval < minX ? minX - xEval : xEval - maxX)
    : 0;

  // Generate curve sampling points for visualization
  const curvePoints = [];
  const padding = (maxX - minX) * 0.25;
  const plotStart = Math.min(minX - padding, xEval - 0.5);
  const plotEnd = Math.max(maxX + padding, xEval + 0.5);
  const numSamples = 100;
  const step = (plotEnd - plotStart) / numSamples;

  for (let i = 0; i <= numSamples; i++) {
    const xi = plotStart + i * step;
    const yi = evaluateNewtonPolynomial(coefficients, xNodes, xi);
    curvePoints.push({ x: xi, y: yi });
  }

  return {
    nodeCount: n,
    degree: n - 1,
    nodes: xNodes.map((xi, idx) => ({ x: xi, y: table[idx][0] })),
    coefficients,
    table,
    xEval,
    evaluatedValue: finalValue,
    terms,
    domain: { min: minX, max: maxX },
    isExtrapolation,
    extrapolationDistance,
    curvePoints,
    academicNotice: isExtrapolation
      ? "EXTRAPOLATION WARNING: Evaluating outside the observed node interval [x_min, x_max] suffers from Runge's phenomenon and severe polynomial oscillation. High-degree interpolation is mathematically invalid for forecasting future semesters."
      : "INTERPOLATION ACTIVE: Query point lies inside the observed node interval. Polynomial passes exactly through all nodes."
  };
}

/* ==========================================================================
   EXPERIMENT D: Runge Phenomenon & Extrapolation Risk
   ========================================================================== */

/**
 * Target deterministic synthetic function for Runge's phenomenon demonstration:
 *   f(x) = 1 / (1 + 25 * x^2) on x in [-1, 1]
 * 
 * @param {number} x 
 * @returns {number}
 */
export function rungeFunction(x) {
  return 1.0 / (1.0 + 25.0 * x * x);
}

/**
 * Runs the Runge Phenomenon and Extrapolation Risk educational experiment.
 * Contrasts low- vs. high-degree polynomial interpolation on equally spaced vs. Chebyshev nodes.
 * 
 * @param {number} nodeCount - Number of nodes (e.g. 5, 7, 9, 11, 13)
 * @param {'equally_spaced'|'chebyshev'} distributionType - Node distribution strategy
 * @param {object} [options]
 * @returns {object} Runge demonstration report
 */
export function runRungeExperiment(nodeCount = 7, distributionType = 'equally_spaced', options = {}) {
  const n = typeof nodeCount === 'number' && nodeCount >= 3 && nodeCount <= 15
    ? Math.round(nodeCount)
    : 7;

  const distType = distributionType === 'chebyshev' ? 'chebyshev' : 'equally_spaced';

  // 1. Generate node coordinates in [-1, 1]
  const xNodes = [];
  if (distType === 'equally_spaced') {
    for (let j = 0; j < n; j++) {
      const xj = -1.0 + (2.0 * j) / (n - 1);
      xNodes.push(xj);
    }
  } else {
    // Chebyshev nodes: clustered near endpoints to suppress Runge oscillations
    // x_j = -cos((2j + 1) * PI / (2 * n))
    for (let j = 0; j < n; j++) {
      const xj = -Math.cos(((2 * j + 1) * Math.PI) / (2 * n));
      xNodes.push(xj);
    }
  }

  // Sort nodes ascending for consistent numerical processing
  xNodes.sort((a, b) => a - b);

  // Compute exact function values at nodes
  const yNodes = xNodes.map(xj => rungeFunction(xj));

  // 2. Compute Newton divided differences
  const { coefficients, table } = computeDividedDifferences(xNodes, yNodes);

  // 3. Evaluate over fine grid (101 points in [-1, 1]) to compute exact errors
  const gridCount = 101;
  const grid = [];
  let maxAbsError = 0.0;
  let maxErrorLocation = 0.0;
  let sumSqError = 0.0;

  for (let i = 0; i < gridCount; i++) {
    const xi = -1.0 + (2.0 * i) / (gridCount - 1);
    const fTrue = rungeFunction(xi);
    const fPoly = evaluateNewtonPolynomial(coefficients, xNodes, xi);
    const err = Math.abs(fTrue - fPoly);

    if (err > maxAbsError) {
      maxAbsError = err;
      maxErrorLocation = xi;
    }
    sumSqError += err * err;

    grid.push({
      x: xi,
      fTrue,
      fPoly,
      error: err
    });
  }

  const rmse = Math.sqrt(sumSqError / gridCount);

  // 4. Extrapolation evaluation (slightly beyond [-1, 1], e.g. at x = 1.15)
  const xExtra = 1.15;
  const fTrueExtra = rungeFunction(xExtra);
  const fPolyExtra = evaluateNewtonPolynomial(coefficients, xNodes, xExtra);
  const extraError = Math.abs(fTrueExtra - fPolyExtra);

  return {
    isSynthetic: true,
    functionName: "f(x) = 1 / (1 + 25x²)",
    interval: [-1.0, 1.0],
    nodeCount: n,
    degree: n - 1,
    distributionType: distType,
    nodes: xNodes.map((xi, idx) => ({ x: xi, y: yNodes[idx] })),
    coefficients,
    grid,
    errorMetrics: {
      maxAbsError,
      maxErrorLocation,
      rmse,
      extrapolationSample: {
        x: xExtra,
        fTrue: fTrueExtra,
        fPoly: fPolyExtra,
        error: extraError
      }
    },
    academicTakeaway: distType === 'equally_spaced' && n >= 9
      ? `RUNGE PHENOMENON ACTIVE: High-degree polynomial (${n - 1}th order) on equally spaced nodes exhibits severe edge oscillation near x = ±1 (Max Error = ${maxAbsError.toFixed(4)}). Although the polynomial matches all ${n} nodes exactly, it diverges wildly between nodes. This proves why high-degree polynomial interpolation must never be used for academic grade prediction.`
      : distType === 'chebyshev'
      ? `CHEBYSHEV DENSITY BENEFIT: Clustered node density near boundaries suppresses the Runge phenomenon (Max Error = ${maxAbsError.toFixed(4)}). However, forward extrapolation outside [-1, 1] still diverges rapidly.`
      : `Moderate degree (${n - 1}th order). Observe how increasing the node count with equally spaced nodes causes edge errors to grow rather than decrease.`
  };
}

/* ==========================================================================
   EDUCATIONAL REFERENCE CONTENT: Numerical Error & Stability Topics
   ========================================================================== */

export const NUMERICAL_STABILITY_TOPICS = [
  {
    id: 'floating_point_errors',
    title: 'Round-Off vs. Truncation Error',
    badge: 'Fundamental Concepts',
    content: `
      In numerical computation, two distinct error sources interact:
      1. **Truncation Error**: The mathematical error introduced by replacing an infinite process with a finite one (e.g. approximating an exponential by a truncated Taylor polynomial, or step size h in finite differences).
      2. **Round-Off Error**: The algebraic error caused by representing real numbers in finite IEEE-754 64-bit floating point format (machine precision ε_mach ≈ 2.22 × 10⁻¹⁶).
      
      While reducing discretization step size h diminishes truncation error, it increases the total number of arithmetic operations, amplifying accumulated round-off error.
    `
  },
  {
    id: 'residual_vs_solution_error',
    title: 'Residual Vector vs. Forward Solution Error',
    badge: 'Linear Systems',
    content: `
      For a computed solution x̂ to A x = b:
      * **Residual Vector**: r = b - A x̂ (backward error: how closely x̂ satisfies the equations).
      * **Solution Error**: e = x_true - x̂ (forward error: how close x̂ is to the true solution).
      
      These are related by: ||e|| ≤ ||A⁻¹|| · ||r||.
      
      **Crucial Principle**: A tiny residual (||r|| ≈ 10⁻¹⁵) does NOT guarantee an accurate solution if the matrix is ill-conditioned! When condition number κ(A) is huge, a small perturbation in b creates large swings in x.
    `
  },
  {
    id: 'normal_equations_conditioning',
    title: 'Normal Equations & Condition Squaring: κ₂(XᵀX) = (κ₂(X))²',
    badge: 'Least Squares',
    content: `
      Solving linear least squares via Normal Equations (XᵀX)β = Xᵀy squares the 2-norm condition number:
      κ₂(XᵀX) = (κ₂(X))².
      
      If design matrix X has condition number 10⁴, the Normal Equations matrix XᵀX has condition number 10⁸!
      
      **ClassPredict Mitigation**:
      1. Predictor centering (x' = x - x̄) decouples slope and intercept, making off-diagonal covariance entries zero.
      2. Scale-aware partial pivoting prevents multiplier blow-up during Gaussian elimination.
    `
  },
  {
    id: 'interpolation_vs_regression',
    title: 'Exact Interpolation vs. Least-Squares Curve Fitting',
    badge: 'Model Selection',
    content: `
      * **Interpolation** forces the mathematical curve to pass exactly through every observed point: P(x_i) = y_i. If data contains stochastic noise (exam flukes, grading curves), interpolation overfits the noise.
      * **Least-Squares Regression** minimizes the aggregate distance to observations: min Σ (y_i - f(x_i))², extracting the underlying structural trend while filtering out noise.
      
      For academic semester transitions, human grade variability is inherently stochastic. Therefore, regression (Model B, Model C) is mathematically appropriate, while high-degree interpolation is strictly pedagogical.
    `
  }
];
