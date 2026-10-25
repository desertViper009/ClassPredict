/**
 * @file regression_engine.js
 * @description Transition construction, persistence baseline, and linear least-squares regression solver.
 * Pure mathematical core decoupled from DOM and UI rendering.
 * Document Reference: docs/NUMERICAL_MODEL.md, docs/REQUIREMENTS.md (FR-01, FR-03, FR-04, FR-08)
 */

import { mean, variance, center, isAllFinite } from './math_utils.js';
import { solveLinearSystem } from './linear_algebra.js';

export const DEFAULT_SCALE_MAX = 4.00;
export const MIN_PREDICTOR_VARIANCE = 1e-12;

/**
 * Constructs valid one-step consecutive-semester transition pairs for a cohort.
 * Strictly excludes missing semester gaps and guarantees no cross-student mixing.
 * 
 * @param {Array<{student_key: string, semester_no: number, sgpa: number}>} records 
 * @param {object} [options]
 * @param {number} [options.scaleMax=DEFAULT_SCALE_MAX]
 * @returns {{ transitions: Array<{student_key: string, from_semester: number, to_semester: number, previous_sgpa: number, next_sgpa: number}>, totalTransitions: number, studentCount: number, skippedGapsCount: number }}
 */
export function buildConsecutiveTransitions(records, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : DEFAULT_SCALE_MAX;

  if (!Array.isArray(records)) {
    throw new Error("Invalid input: records must be an array.");
  }

  // 1. Validate individual record structure and values
  const studentMap = new Map();
  const seenCombinations = new Set();

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r || typeof r !== 'object') {
      throw new Error(`Record at index ${i} is not a valid object.`);
    }

    const key = typeof r.student_key === 'string' ? r.student_key.trim() : '';
    if (key === '' || !/^[A-Za-z0-9_-]{1,32}$/.test(key)) {
      throw new Error(`Record at index ${i} contains an invalid or empty student_key.`);
    }

    const sem = Number(r.semester_no);
    if (!Number.isInteger(sem) || sem < 1 || sem > 12) {
      throw new Error(`Record at index ${i} contains an invalid semester_no (must be integer 1-12).`);
    }

    const sgpa = Number(r.sgpa);
    if (!Number.isFinite(sgpa) || sgpa < 0.00 || sgpa > scaleMax) {
      throw new Error(`Record at index ${i} contains out-of-scale or non-finite sgpa.`);
    }

    const comboKey = `${key}#${sem}`;
    if (seenCombinations.has(comboKey)) {
      throw new Error(`Duplicate record detected for student in semester ${sem}.`);
    }
    seenCombinations.add(comboKey);

    if (!studentMap.has(key)) {
      studentMap.set(key, []);
    }
    // Store deep copy of record
    studentMap.get(key).push({ semester_no: sem, sgpa });
  }

  const transitions = [];
  let skippedGapsCount = 0;

  // 2. Build one-step transitions per student
  studentMap.forEach((semRecords, key) => {
    // Sort student's records chronologically
    semRecords.sort((a, b) => a.semester_no - b.semester_no);

    for (let i = 0; i < semRecords.length - 1; i++) {
      const current = semRecords[i];
      const next = semRecords[i + 1];

      // Strictly enforce one-step consecutive relationship
      if (next.semester_no - current.semester_no === 1) {
        transitions.push({
          student_key: key,
          from_semester: current.semester_no,
          to_semester: next.semester_no,
          previous_sgpa: current.sgpa,
          next_sgpa: next.sgpa
        });
      } else {
        // Gap detected: non-consecutive leap is strictly excluded
        skippedGapsCount++;
      }
    }
  });

  // 3. Deterministic sorting: student_key ASC, from_semester ASC
  transitions.sort((a, b) => {
    const keyComp = a.student_key.localeCompare(b.student_key);
    if (keyComp !== 0) return keyComp;
    return a.from_semester - b.from_semester;
  });

  return {
    transitions,
    totalTransitions: transitions.length,
    studentCount: studentMap.size,
    skippedGapsCount
  };
}

/**
 * Evaluates the Persistence Baseline forecast: \hat{s}_{t+1} = s_t.
 * Does not clip or clamp out-of-range inputs; reports them transparently.
 * 
 * @param {number} latestSgpa - Observed SGPA at semester t
 * @param {object} [options]
 * @param {number} [options.scaleMax=DEFAULT_SCALE_MAX]
 * @returns {{ modelId: string, modelName: string, previousSgpa: number, rawPrediction: number, isOutOfRange: boolean }}
 */
export function predictPersistence(latestSgpa, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : DEFAULT_SCALE_MAX;

  if (typeof latestSgpa !== 'number' || !Number.isFinite(latestSgpa)) {
    throw new Error("Persistence predictor requires a finite numeric SGPA input.");
  }

  const isOutOfRange = latestSgpa < 0.00 || latestSgpa > scaleMax;

  return {
    modelId: "MODEL_A_PERSISTENCE",
    modelName: "Persistence Baseline",
    previousSgpa: latestSgpa,
    rawPrediction: latestSgpa, // Mathematical prediction is identical to latest observation
    isOutOfRange
  };
}

/**
 * Fits a Class-Wide Linear Least-Squares Regression model:
 *   y = a + b*x + epsilon
 * 
 * Formulation & Numerical Conditioning:
 * 1. Predictor Centering: Centers x' = x - mean(x).
 * 2. Forms decoupled Normal Equations:
 *      [ n           sum(x') ] [ a' ] = [ sum(y)    ]
 *      [ sum(x')  sum((x')^2)] [ b' ]   [ sum(x'*y) ]
 *    Since sum(x') = 0, off-diagonal covariance is eliminated, diagonalizing (X'^T X').
 * 3. Solves for [a', b'] using Gaussian elimination with row partial pivoting.
 * 4. Converts coefficients back to original coordinate system:
 *      b = b'
 *      a = a' - b * mean(x)
 * 
 * @param {number[]} x - Previous semester SGPA array (predictors)
 * @param {number[]} y - Next consecutive semester SGPA array (responses)
 * @param {object} [options]
 * @param {number} [options.scaleMax=DEFAULT_SCALE_MAX]
 * @param {number} [options.minVariance=MIN_PREDICTOR_VARIANCE]
 * @returns {object} Fitted model object
 */
export function fitLinearRegression(x, y, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : DEFAULT_SCALE_MAX;
  const scaleMaxX = typeof options.scaleMaxX === 'number' ? options.scaleMaxX : scaleMax;
  const scaleMaxY = typeof options.scaleMaxY === 'number' ? options.scaleMaxY : scaleMax;
  const minVariance = typeof options.minVariance === 'number' ? options.minVariance : MIN_PREDICTOR_VARIANCE;

  // 1. Array Dimension & Type Validation
  if (!Array.isArray(x) || !Array.isArray(y)) {
    throw new Error("Inputs x and y must be arrays.");
  }

  if (x.length !== y.length) {
    throw new Error(`Dimension mismatch: x has ${x.length} elements, but y has ${y.length} elements.`);
  }

  const n = x.length;
  if (n < 2) {
    throw new Error(`Insufficient observations: Linear regression requires at least 2 data points, found ${n}.`);
  }

  // 2. Finite & Scale Validation
  if (!isAllFinite(x) || !isAllFinite(y)) {
    throw new Error("Inputs contain non-finite numbers (NaN or Infinity).");
  }

  for (let i = 0; i < n; i++) {
    if (x[i] < 0.00 || x[i] > scaleMaxX || y[i] < 0.00 || y[i] > scaleMaxY) {
      throw new Error(`Value out of scale at index ${i}.`);
    }
  }

  // 3. Immutability: Work on independent copies
  const xCopy = [...x];
  const yCopy = [...y];

  // 4. Input Variance Pre-Check (Singularity Guard)
  const meanX = mean(xCopy);
  const meanY = mean(yCopy);
  const varX = variance(xCopy);

  if (varX < minVariance) {
    throw new Error(
      `Insufficient variation in predictor: sample variance (${varX.toExponential(4)}) is near zero. Matrix is rank deficient.`
    );
  }

  // 5. Predictor Centering (Decoupling off-diagonal terms)
  const { centered: xCentered } = center(xCopy);

  let sumXCenteredSq = 0;
  let sumY = 0;
  let sumXCenteredY = 0;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < n; i++) {
    const xc = xCentered[i];
    const yi = yCopy[i];

    sumXCenteredSq += xc * xc;
    sumY += yi;
    sumXCenteredY += xc * yi;

    if (xCopy[i] < minX) minX = xCopy[i];
    if (xCopy[i] > maxX) maxX = xCopy[i];
    if (yi < minY) minY = yi;
    if (yi > maxY) maxY = yi;
  }

  // 6. Form Centered Normal Equations: A * [a', b'] = rhs
  // A = [ [n, 0], [0, sumXCenteredSq] ]
  // rhs = [ sumY, sumXCenteredY ]
  const A = [
    [n, 0],
    [0, sumXCenteredSq]
  ];
  const rhs = [sumY, sumXCenteredY];

  // Solve system using Gaussian elimination with scale-aware partial pivoting
  const solution = solveLinearSystem(A, rhs);
  const aPrime = solution[0]; // a' = mean(y)
  const b = solution[1];      // slope

  if (!Number.isFinite(aPrime) || !Number.isFinite(b)) {
    throw new Error("Non-finite coefficients computed during regression fit.");
  }

  // 7. Coordinate Conversion: Uncenter intercept
  const a = aPrime - b * meanX;

  if (!Number.isFinite(a)) {
    throw new Error("Non-finite intercept computed during coordinate conversion.");
  }

  return {
    modelId: "MODEL_B_LINEAR_REGRESSION",
    modelName: "Class-Wide Linear Regression",
    coefficients: { a, b },
    formula: `s_{t+1} = ${a.toFixed(4)} + ${b.toFixed(4)} * s_t`,
    sampleCount: n,
    predictorRange: { min: minX, max: maxX },
    responseRange: { min: minY, max: maxY },
    predictorMean: meanX,
    responseMean: meanY,
    predictorVariance: varX,
    metadata: {
      method: "Least Squares via Normal Equations with Centering and Gaussian Elimination",
      solver: "Gaussian Elimination with Scale-Aware Partial Pivoting",
      centered: true,
      scaleMax
    },

    /**
     * Predicts next SGPA for a given prior SGPA.
     * Preserves raw mathematical output without silent clamping.
     * 
     * @param {number} previousSgpa 
     * @returns {{ rawPrediction: number, previousSgpa: number, isOutOfRange: boolean, modelId: string }}
     */
    predict: function(previousSgpa) {
      if (typeof previousSgpa !== 'number' || !Number.isFinite(previousSgpa)) {
        throw new Error("Predictor requires a finite numeric SGPA input.");
      }

      const rawPrediction = a + b * previousSgpa;
      const isOutOfRange = rawPrediction < 0.00 || rawPrediction > scaleMax;

      return {
        rawPrediction,
        previousSgpa,
        isOutOfRange,
        modelId: "MODEL_B_LINEAR_REGRESSION"
      };
    }
  };
}

/**
 * Fits linear regression directly from an array of validated transition records.
 * 
 * @param {Array<{previous_sgpa: number, next_sgpa: number}>} transitions 
 * @param {object} [options]
 * @returns {object} Fitted model object
 */
export function fitTransitionRegression(transitions, options = {}) {
  if (!Array.isArray(transitions) || transitions.length === 0) {
    throw new Error("Transitions must be a non-empty array.");
  }

  const x = transitions.map(t => t.previous_sgpa);
  const y = transitions.map(t => t.next_sgpa);

  return fitLinearRegression(x, y, options);
}

/**
 * Fits Model C: Individual Least-Squares Trend for a single student trajectory:
 *   s_k = a + b*k + epsilon_k
 * 
 * Predicts the next-semester SGPA by evaluating the fitted trend line at
 * k_target = k_latest + 1 without requiring cohort transitions.
 * 
 * Degrees of Freedom & Volatility Policy:
 *   nu = K - 2 (where K is count of observed semesters, 3 <= K <= 7).
 *   K = 3 (nu = 1, t_crit = 12.71): Extreme Volatility Warning.
 *   K = 4 (nu = 2, t_crit = 4.30): High Volatility Warning.
 *   K = 5 (nu = 3, t_crit = 3.18): Moderate Volatility.
 *   K >= 6 (nu >= 4, t_crit <= 2.78): Adequate sample horizon.
 * 
 * @param {Array<{semester_no: number, sgpa: number}>} observations 
 * @param {object} [options]
 * @param {number} [options.scaleMax=DEFAULT_SCALE_MAX]
 * @param {number} [options.minVariance=MIN_PREDICTOR_VARIANCE]
 * @returns {object} Individual trend model and prediction report
 */
export function fitIndividualTrend(observations, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : DEFAULT_SCALE_MAX;
  const minVariance = typeof options.minVariance === 'number' ? options.minVariance : MIN_PREDICTOR_VARIANCE;

  if (!Array.isArray(observations)) {
    throw new Error("Observations must be an array.");
  }

  const n = observations.length;
  if (n < 3 || n > 7) {
    throw new Error(`Individual least-squares trend requires between 3 and 7 observed semesters (found ${n}).`);
  }

  // 1. Deep clone and validate entries
  const seenSemesters = new Set();
  const cleaned = [];

  for (let i = 0; i < n; i++) {
    const obs = observations[i];
    if (!obs || typeof obs !== 'object') {
      throw new Error(`Observation at index ${i} is not a valid object.`);
    }

    const sem = Number(obs.semester_no);
    if (!Number.isInteger(sem) || sem < 1 || sem > 12) {
      throw new Error(`Observation at index ${i} contains an invalid semester_no (must be integer 1-12).`);
    }

    const sgpa = Number(obs.sgpa);
    if (!Number.isFinite(sgpa) || sgpa < 0.00 || sgpa > scaleMax) {
      throw new Error(`Observation at index ${i} contains out-of-scale or non-finite sgpa (must be 0.00-${scaleMax.toFixed(2)}).`);
    }

    if (seenSemesters.has(sem)) {
      throw new Error(`Duplicate semester number ${sem} detected in individual history.`);
    }
    seenSemesters.add(sem);

    cleaned.push({ semester_no: sem, sgpa });
  }

  // 2. Sort observations chronologically by semester_no ASC
  cleaned.sort((a, b) => a.semester_no - b.semester_no);

  const kLatest = cleaned[cleaned.length - 1].semester_no;
  const sLatest = cleaned[cleaned.length - 1].sgpa;
  const kTarget = kLatest + 1;

  // 3. Extract predictor (k) and response (s_k)
  const kArr = cleaned.map(o => o.semester_no);
  const sArr = cleaned.map(o => o.sgpa);

  // 4. Fit linear regression using centered Normal Equations solver
  const fitted = fitLinearRegression(kArr, sArr, { scaleMaxX: 12, scaleMaxY: scaleMax, scaleMax, minVariance });
  const a = fitted.coefficients.a;
  const b = fitted.coefficients.b;

  // 5. Evaluate forecast at kTarget without clamping
  const rawPrediction = a + b * kTarget;
  const isOutOfRange = rawPrediction < 0.00 || rawPrediction > scaleMax;

  // 6. Volatility & Degrees of Freedom Assessment
  const nu = n - 2;
  const tCriticalMap = {
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571
  };
  const tCrit = tCriticalMap[nu] || 2.571;

  let volatilityWarning = null;
  if (nu === 1) {
    volatilityWarning = "Extreme Volatility Warning: 3 semesters provide only 1 residual degree of freedom (t_crit = 12.71). An isolated anomaly heavily levers the slope.";
  } else if (nu === 2) {
    volatilityWarning = "High Volatility Warning: 4 semesters provide only 2 residual degrees of freedom (t_crit = 4.30). Single outlier semester strongly influences forecast.";
  } else if (nu === 3) {
    volatilityWarning = "Moderate Volatility: 5 semesters provide 3 residual degrees of freedom (t_crit = 3.18). Basic trend stability.";
  }

  return {
    modelId: "MODEL_C_INDIVIDUAL_TREND",
    modelName: "Individual Least-Squares Trend",
    coefficients: { a, b },
    formula: `s_k = ${a.toFixed(4)} + ${b.toFixed(4)} * k`,
    observationCount: n,
    degreesOfFreedom: nu,
    tCritical: tCrit,
    volatilityWarning,
    latestSemester: kLatest,
    latestSgpa: sLatest,
    targetSemester: kTarget,
    rawPrediction,
    isOutOfRange,
    sortedObservations: cleaned,
    predict: function(targetK) {
      if (typeof targetK !== 'number' || !Number.isFinite(targetK)) {
        throw new Error("Target semester must be a finite number.");
      }
      const pred = a + b * targetK;
      return {
        rawPrediction: pred,
        targetSemester: targetK,
        isOutOfRange: pred < 0.00 || pred > scaleMax
      };
    }
  };
}

