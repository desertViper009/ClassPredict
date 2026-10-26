/**
 * @file dashboard_analytics.js
 * @description Pure numerical analytics and data transformation engine for Phase 8 Analytical Dashboard.
 * Computes cohort summaries, semester distributions (histograms & boxplots), regression transitions,
 * in-sample residuals, transition matrices, deterministic IQR review candidate detection,
 * and temporal evaluation comparisons.
 * Completely decoupled from DOM, SVG, and UI rendering for headless testability.
 * Document Reference: docs/NUMERICAL_MODEL.md, docs/REQUIREMENTS.md (FR-01, FR-08)
 */

import { DEFAULT_SCALE_MAX, MIN_PREDICTOR_VARIANCE, buildConsecutiveTransitions, fitTransitionRegression } from './regression_engine.js';
import { evaluateTemporalFolds, FOLD_STATUS, EVALUATION_STATUS } from './temporal_validator.js';
import { mean, variance } from './math_utils.js';

export const GPA_SCALE_MAX = DEFAULT_SCALE_MAX; // 4.00

/**
 * Computes quantile on a sorted array of numbers using standard linear interpolation
 * (R-7 / NumPy / Excel default convention: index = p * (n - 1)).
 * 
 * @param {number[]} sortedValues - Array of numbers sorted ascending
 * @param {number} p - Percentile in [0, 1]
 * @returns {number} Quantile value
 */
export function calculateQuantile(sortedValues, p) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
    throw new Error("Quantile calculation requires a non-empty array.");
  }
  if (p < 0 || p > 1) {
    throw new Error("Percentile p must be in range [0, 1].");
  }

  const n = sortedValues.length;
  if (n === 1) return sortedValues[0];

  const index = p * (n - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const fraction = index - lowerIndex;

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  return sortedValues[lowerIndex] + fraction * (sortedValues[upperIndex] - sortedValues[lowerIndex]);
}

/**
 * Computes cohort overview and dataset summary metrics.
 * 
 * @param {Array<{student_key: string, semester_no: number, sgpa: number}>} dataset 
 * @param {object} [options]
 * @param {number} [options.scaleMax=GPA_SCALE_MAX]
 * @returns {object} Cohort summary metrics and model status
 */
export function computeCohortOverview(dataset, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : GPA_SCALE_MAX;

  if (!Array.isArray(dataset) || dataset.length === 0) {
    return {
      hasDataset: false,
      isSynthetic: false,
      totalStudents: 0,
      totalRecords: 0,
      minSemester: null,
      maxSemester: null,
      observedSemesters: [],
      validTransitionsCount: 0,
      studentsWithGapsCount: 0,
      hasIncompleteHistories: false,
      canFitRegression: false,
      regressionStatus: "NO_DATASET",
      regressionMessage: "No dataset accepted in session memory.",
      evaluationAvailable: false,
      evaluationStatus: "UNAVAILABLE_NO_DATASET"
    };
  }

  const studentMap = new Map();
  const semesterSet = new Set();
  let minSem = Infinity;
  let maxSem = -Infinity;

  for (const r of dataset) {
    if (!studentMap.has(r.student_key)) {
      studentMap.set(r.student_key, []);
    }
    studentMap.get(r.student_key).push(r.semester_no);
    semesterSet.add(r.semester_no);
    if (r.semester_no < minSem) minSem = r.semester_no;
    if (r.semester_no > maxSem) maxSem = r.semester_no;
  }

  const observedSemesters = Array.from(semesterSet).sort((a, b) => a - b);
  const totalStudents = studentMap.size;
  const totalRecords = dataset.length;

  let studentsWithGapsCount = 0;
  let hasIncompleteHistories = false;
  const fullSpan = maxSem - minSem + 1;

  studentMap.forEach((semesters) => {
    semesters.sort((a, b) => a - b);
    if (semesters.length < fullSpan) {
      hasIncompleteHistories = true;
    }
    for (let i = 0; i < semesters.length - 1; i++) {
      if (semesters[i + 1] - semesters[i] > 1) {
        studentsWithGapsCount++;
        break;
      }
    }
  });

  // Calculate valid consecutive transitions
  let transitionsData;
  try {
    transitionsData = buildConsecutiveTransitions(dataset, { scaleMax });
  } catch {
    transitionsData = { transitions: [], totalTransitions: 0, skippedGapsCount: 0 };
  }

  const validTransitionsCount = transitionsData.totalTransitions;

  // Determine regression model viability
  let canFitRegression = false;
  let regressionStatus = "INSUFFICIENT_TRANSITIONS";
  let regressionMessage = `Insufficient consecutive transitions (found ${validTransitionsCount}, minimum 2 required).`;
  let fittedModel = null;

  if (validTransitionsCount >= 2) {
    try {
      fittedModel = fitTransitionRegression(transitionsData.transitions, { scaleMax });
      canFitRegression = true;
      regressionStatus = "REGRESSION_AVAILABLE";
      regressionMessage = `Fitted model: ${fittedModel.formula} (n = ${validTransitionsCount}). Note: Model fit does not guarantee future accuracy.`;
    } catch (err) {
      canFitRegression = false;
      regressionStatus = "FIT_FAILED";
      regressionMessage = `Linear regression fit failed: ${err.message}`;
    }
  }

  // Determine evaluation availability
  let evaluationAvailable = false;
  let evaluationStatus = "INSUFFICIENT_DATA";
  if (observedSemesters.length >= 3 && validTransitionsCount >= 3) {
    evaluationAvailable = true;
    evaluationStatus = "EVALUATION_AVAILABLE";
  }

  return {
    hasDataset: true,
    isSynthetic: dataset.length > 0 && dataset.every(r => typeof r.student_key === 'string' && r.student_key.startsWith('SYN_')),
    totalStudents,
    totalRecords,
    minSemester: Number.isFinite(minSem) ? minSem : null,
    maxSemester: Number.isFinite(maxSem) ? maxSem : null,
    observedSemesters,
    validTransitionsCount,
    studentsWithGapsCount,
    hasIncompleteHistories,
    canFitRegression,
    regressionStatus,
    regressionMessage,
    evaluationAvailable,
    evaluationStatus,
    fittedModelSummary: fittedModel ? {
      a: fittedModel.coefficients.a,
      b: fittedModel.coefficients.b,
      formula: fittedModel.formula,
      sampleCount: fittedModel.sampleCount,
      predictorVariance: fittedModel.predictorVariance
    } : null
  };
}

/**
 * Computes semester SGPA distribution: 8-bin histogram and Tukey boxplot.
 * 
 * Binning Method:
 * 8 uniform bins of width 0.50 over [0.00, scaleMax]:
 * [0.0, 0.5), [0.5, 1.0), [1.0, 1.5), [1.5, 2.0), [2.0, 2.5), [2.5, 3.0), [3.0, 3.5), [3.5, 4.0]
 * Boundary Rule:
 * Lower bound is inclusive; upper bound is exclusive, except the highest bin which includes the upper ceiling.
 * 
 * Boxplot Method:
 * Standard linear interpolation quartiles: Q1 = 25th percentile, Q2 = 50th percentile (median), Q3 = 75th percentile.
 * IQR = Q3 - Q1.
 * Lower Whisker = max(min(x), Q1 - 1.5 * IQR).
 * Upper Whisker = min(max(x), Q3 + 1.5 * IQR).
 * Points beyond whiskers are flagged as individual outliers for auditor review.
 * 
 * @param {Array<{student_key: string, semester_no: number, sgpa: number}>} dataset 
 * @param {number} semesterNo 
 * @param {object} [options]
 * @param {number} [options.scaleMax=GPA_SCALE_MAX]
 * @param {number} [options.numBins=8]
 * @returns {object} Distribution metrics, histogram bins, boxplot summary, and outliers
 */
export function computeSemesterDistribution(dataset, semesterNo, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : GPA_SCALE_MAX;
  const numBins = typeof options.numBins === 'number' && options.numBins > 0 ? options.numBins : 8;

  if (!Array.isArray(dataset)) {
    throw new Error("Dataset must be an array.");
  }

  const semesterRecords = dataset.filter(r => r && r.semester_no === semesterNo);
  const sgpaValues = semesterRecords
    .map(r => Number(r.sgpa))
    .filter(val => Number.isFinite(val) && val >= 0.00 && val <= scaleMax);

  const n = sgpaValues.length;
  if (n === 0) {
    return {
      semesterNo,
      observationCount: 0,
      scaleMax,
      insufficientData: true,
      message: `No valid observations found for semester ${semesterNo}.`,
      histogram: null,
      boxplot: null,
      statistics: null
    };
  }

  // Sort ascending for statistics and boxplot
  const sorted = [...sgpaValues].sort((a, b) => a - b);

  // 1. Histogram Construction
  const binWidth = scaleMax / numBins;
  const bins = [];

  for (let b = 0; b < numBins; b++) {
    const min = b * binWidth;
    const max = (b + 1) * binWidth;
    bins.push({
      binIndex: b,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      label: `${min.toFixed(2)} - ${max.toFixed(2)}`,
      count: 0,
      frequency: 0,
      studentKeys: []
    });
  }

  for (let i = 0; i < semesterRecords.length; i++) {
    const r = semesterRecords[i];
    const val = Number(r.sgpa);
    if (!Number.isFinite(val) || val < 0.00 || val > scaleMax) continue;

    let placed = false;
    for (let b = 0; b < numBins; b++) {
      const isLast = (b === numBins - 1);
      const inBin = isLast 
        ? (val >= bins[b].min && val <= bins[b].max)
        : (val >= bins[b].min && val < bins[b].max);

      if (inBin) {
        bins[b].count++;
        bins[b].studentKeys.push(r.student_key);
        placed = true;
        break;
      }
    }
    // Fallback if exactly at scaleMax
    if (!placed && val === scaleMax) {
      bins[numBins - 1].count++;
      bins[numBins - 1].studentKeys.push(r.student_key);
    }
  }

  for (const bin of bins) {
    bin.frequency = n > 0 ? bin.count / n : 0;
  }

  // 2. Descriptive Statistics
  const avg = mean(sorted);
  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];
  const varVal = n > 1 ? variance(sorted) : 0;
  const stdVal = Math.sqrt(varVal);

  // 3. Boxplot & Quartiles
  const q1 = calculateQuantile(sorted, 0.25);
  const median = calculateQuantile(sorted, 0.50);
  const q3 = calculateQuantile(sorted, 0.75);
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Whiskers: lowest/highest datum within 1.5 IQR
  let lowerWhisker = minVal;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= lowerBound) {
      lowerWhisker = sorted[i];
      break;
    }
  }

  let upperWhisker = maxVal;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i] <= upperBound) {
      upperWhisker = sorted[i];
      break;
    }
  }

  // Outliers: points strictly outside [lowerWhisker, upperWhisker]
  const outliers = [];
  for (const r of semesterRecords) {
    const val = Number(r.sgpa);
    if (val < lowerWhisker || val > upperWhisker) {
      outliers.push({
        student_key: r.student_key,
        sgpa: val,
        position: val < lowerWhisker ? "LOW" : "HIGH",
        deviation: val < lowerWhisker ? lowerWhisker - val : val - upperWhisker
      });
    }
  }

  const smallSampleNotice = n < 4 
    ? `Small sample size (n = ${n}). Boxplot quartiles may have high sampling variability.`
    : null;

  return {
    semesterNo,
    observationCount: n,
    scaleMax,
    insufficientData: false,
    smallSampleNotice,
    histogram: {
      binWidth,
      bins,
      maxBinCount: Math.max(...bins.map(b => b.count))
    },
    boxplot: {
      min: minVal,
      q1,
      median,
      q3,
      max: maxVal,
      iqr,
      lowerWhisker,
      upperWhisker,
      outliers,
      outlierCount: outliers.length
    },
    statistics: {
      count: n,
      mean: avg,
      variance: varVal,
      stdDev: stdVal,
      min: minVal,
      max: maxVal
    }
  };
}

/**
 * Computes consecutive-semester transition scatter points, fitted regression line,
 * and persistence reference line.
 * 
 * @param {Array<{student_key: string, semester_no: number, sgpa: number}>} dataset 
 * @param {object} [options]
 * @param {number} [options.scaleMax=GPA_SCALE_MAX]
 * @returns {object} Transition scatter data, fitted line, and overlap points
 */
export function computeTransitionScatter(dataset, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : GPA_SCALE_MAX;

  if (!Array.isArray(dataset) || dataset.length === 0) {
    return {
      hasTransitions: false,
      totalTransitions: 0,
      points: [],
      overlapGroups: [],
      regressionModel: null,
      persistenceLine: { x1: 0, y1: 0, x2: scaleMax, y2: scaleMax },
      message: "No dataset available to compute transitions."
    };
  }

  let transitionsData;
  try {
    transitionsData = buildConsecutiveTransitions(dataset, { scaleMax });
  } catch (err) {
    return {
      hasTransitions: false,
      totalTransitions: 0,
      points: [],
      overlapGroups: [],
      regressionModel: null,
      persistenceLine: { x1: 0, y1: 0, x2: scaleMax, y2: scaleMax },
      message: `Failed to construct transitions: ${err.message}`
    };
  }

  const transitions = transitionsData.transitions;
  if (transitions.length === 0) {
    return {
      hasTransitions: false,
      totalTransitions: 0,
      points: [],
      overlapGroups: [],
      regressionModel: null,
      persistenceLine: { x1: 0, y1: 0, x2: scaleMax, y2: scaleMax },
      message: "No valid consecutive-semester transitions found in dataset."
    };
  }

  // Attempt to fit regression line using existing Phase 4 solver
  let regressionModel = null;
  let regressionLine = null;

  if (transitions.length >= 2) {
    try {
      regressionModel = fitTransitionRegression(transitions, { scaleMax });
      const a = regressionModel.coefficients.a;
      const b = regressionModel.coefficients.b;

      // Line over domain [0, scaleMax]
      const yAtZero = a;
      const yAtMax = a + b * scaleMax;

      regressionLine = {
        x1: 0,
        y1: yAtZero,
        x2: scaleMax,
        y2: yAtMax,
        formula: regressionModel.formula,
        slope: b,
        intercept: a,
        isOutOfRange: yAtZero < 0 || yAtZero > scaleMax || yAtMax < 0 || yAtMax > scaleMax
      };
    } catch {
      regressionModel = null;
      regressionLine = null;
    }
  }

  // Track overlapping points with identical (x, y) coordinates
  const coordinateMap = new Map();
  const points = [];

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    const x = t.previous_sgpa;
    const y = t.next_sgpa;
    const coordKey = `${x.toFixed(3)}#${y.toFixed(3)}`;

    const predictedY = regressionModel ? regressionModel.coefficients.a + regressionModel.coefficients.b * x : null;
    const residual = predictedY !== null ? y - predictedY : null;

    const point = {
      index: i,
      student_key: t.student_key,
      from_semester: t.from_semester,
      to_semester: t.to_semester,
      x,
      y,
      predicted_y: predictedY,
      residual,
      isOutOfRange: predictedY !== null ? (predictedY < 0.00 || predictedY > scaleMax) : false
    };

    points.push(point);

    if (!coordinateMap.has(coordKey)) {
      coordinateMap.set(coordKey, []);
    }
    coordinateMap.get(coordKey).push(point);
  }

  const overlapGroups = [];
  coordinateMap.forEach((pts, key) => {
    if (pts.length > 1) {
      const [xStr, yStr] = key.split('#');
      overlapGroups.push({
        x: Number(xStr),
        y: Number(yStr),
        count: pts.length,
        studentKeys: pts.map(p => p.student_key)
      });
    }
  });

  return {
    hasTransitions: true,
    totalTransitions: transitions.length,
    points,
    overlapGroups,
    regressionModel: regressionModel ? {
      formula: regressionModel.formula,
      coefficients: regressionModel.coefficients,
      sampleCount: regressionModel.sampleCount,
      predictorVariance: regressionModel.predictorVariance
    } : null,
    regressionLine,
    persistenceLine: {
      x1: 0,
      y1: 0,
      x2: scaleMax,
      y2: scaleMax,
      label: "Persistence Baseline (y = x)"
    }
  };
}

/**
 * Computes in-sample regression residuals: e_i = y_i - \hat{y}_i.
 * Distinctly labeled as in-sample training residuals (NOT out-of-sample temporal validation errors).
 * 
 * @param {Array<{student_key: string, semester_no: number, sgpa: number}>} dataset 
 * @param {object} [options]
 * @param {number} [options.scaleMax=GPA_SCALE_MAX]
 * @returns {object} In-sample residual metrics, points, and summary statistics
 */
export function computeResidualAnalysis(dataset, options = {}) {
  const scatterData = computeTransitionScatter(dataset, options);

  if (!scatterData.hasTransitions || !scatterData.regressionModel) {
    return {
      hasResiduals: false,
      count: 0,
      residuals: [],
      statistics: null,
      message: "Residual analysis unavailable: requires at least 2 valid consecutive transitions and fittable regression model."
    };
  }

  const residualPoints = scatterData.points.map(p => ({
    student_key: p.student_key,
    from_semester: p.from_semester,
    to_semester: p.to_semester,
    actual_sgpa: p.y,
    predicted_sgpa: p.predicted_y,
    residual: p.residual
  }));

  const residualValues = residualPoints.map(r => r.residual);
  const n = residualValues.length;
  const sorted = [...residualValues].sort((a, b) => a - b);

  const avgResidual = mean(sorted); // Mathematically zero in least-squares with centering
  const varResidual = n > 1 ? variance(sorted) : 0;
  const stdResidual = Math.sqrt(varResidual);
  const medianResidual = calculateQuantile(sorted, 0.50);
  const q1 = calculateQuantile(sorted, 0.25);
  const q3 = calculateQuantile(sorted, 0.75);
  const iqr = q3 - q1;

  return {
    hasResiduals: true,
    count: n,
    residuals: residualPoints,
    statistics: {
      mean: avgResidual,
      stdDev: stdResidual,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: medianResidual,
      q1,
      q3,
      iqr
    },
    notice: "These are in-sample residuals from the fitted training data. They describe model fit, not predictive accuracy on unseen semesters."
  };
}

/**
 * Computes the dataset transition summary matrix:
 * A K x K matrix where entry (r, c) indicates the count of valid transitions
 * from semester r to semester c.
 * Strictly enforces that one-step consecutive transitions (c === r + 1) are counted,
 * while non-consecutive pairs (e.g. 1 -> 3) are strictly marked 0 / N/A under non-bridging rules.
 * 
 * @param {Array<{student_key: string, semester_no: number, sgpa: number}>} dataset 
 * @param {object} [options]
 * @returns {object} Transition matrix rows, columns, counts, and metadata
 */
export function computeTransitionMatrix(dataset, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : GPA_SCALE_MAX;

  if (!Array.isArray(dataset) || dataset.length === 0) {
    return {
      hasTransitions: false,
      semesters: [],
      matrix: [],
      totalConsecutiveTransitions: 0,
      message: "No dataset available to compute transition matrix."
    };
  }

  let transitionsData;
  try {
    transitionsData = buildConsecutiveTransitions(dataset, { scaleMax });
  } catch {
    transitionsData = { transitions: [], totalTransitions: 0, skippedGapsCount: 0 };
  }

  const semesterSet = new Set();
  for (const r of dataset) {
    semesterSet.add(r.semester_no);
  }

  const semesters = Array.from(semesterSet).sort((a, b) => a - b);
  if (semesters.length === 0) {
    return {
      hasTransitions: false,
      semesters: [],
      matrix: [],
      totalConsecutiveTransitions: 0,
      message: "No observed semesters in dataset."
    };
  }

  // Count consecutive transitions per (from, to) pair
  const transitionCountMap = new Map();
  for (const t of transitionsData.transitions) {
    const key = `${t.from_semester}->${t.to_semester}`;
    transitionCountMap.set(key, (transitionCountMap.get(key) || 0) + 1);
  }

  // Matrix construction
  const matrix = [];
  for (let r = 0; r < semesters.length; r++) {
    const fromSem = semesters[r];
    const row = {
      fromSemester: fromSem,
      cells: []
    };

    for (let c = 0; c < semesters.length; c++) {
      const toSem = semesters[c];
      const isConsecutive = (toSem - fromSem === 1);
      const isSelf = (toSem === fromSem);
      const isPast = (toSem < fromSem);
      const isSkipGap = (toSem - fromSem > 1);

      let count = 0;
      let status = "CONSECUTIVE";
      let description = "";

      if (isConsecutive) {
        count = transitionCountMap.get(`${fromSem}->${toSem}`) || 0;
        status = "CONSECUTIVE";
        description = `${count} student(s) observed in both Sem ${fromSem} and Sem ${toSem}`;
      } else if (isSelf) {
        status = "SELF";
        description = "Identical semester (no transition)";
      } else if (isPast) {
        status = "RETROGRADE";
        description = "Reverse transition (chronologically impossible)";
      } else if (isSkipGap) {
        status = "GAP_SKIPPED";
        description = "Non-consecutive semester gap (strictly excluded by non-bridging rule)";
      }

      row.cells.push({
        fromSemester: fromSem,
        toSemester: toSem,
        count,
        isConsecutive,
        status,
        description
      });
    }

    matrix.push(row);
  }

  return {
    hasTransitions: transitionsData.totalTransitions > 0,
    semesters,
    matrix,
    totalConsecutiveTransitions: transitionsData.totalTransitions,
    skippedGapsCount: transitionsData.skippedGapsCount
  };
}

/**
 * Transparent, deterministic rule for flagging potentially unusual observations
 * or large residuals.
 * 
 * Rules:
 * 1. Semester SGPA Distribution Outlier:
 *    Evaluated for each semester with n >= 4.
 *    Flagged if value < Q1 - 1.5 * IQR or value > Q3 + 1.5 * IQR.
 * 2. Regression Residual Outlier:
 *    Evaluated on in-sample residuals when n >= 4 transitions exist.
 *    Flagged if |e_i - median(e)| > 1.5 * IQR(e).
 * 
 * Note: These are flagged as REVIEW CANDIDATES, not errors. They must never be deleted automatically.
 * 
 * @param {Array<{student_key: string, semester_no: number, sgpa: number}>} dataset 
 * @param {object} [options]
 * @returns {object} Array of flagged review candidates and diagnostic metadata
 */
export function detectUnusualObservations(dataset, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : GPA_SCALE_MAX;

  if (!Array.isArray(dataset) || dataset.length === 0) {
    return {
      detectionAvailable: false,
      candidates: [],
      message: "No dataset available to evaluate unusual observations."
    };
  }

  const candidates = [];
  const semesterSet = new Set(dataset.map(r => r.semester_no));
  const observedSemesters = Array.from(semesterSet).sort((a, b) => a - b);

  // 1. Evaluate Semester SGPA Distribution Outliers
  for (const sem of observedSemesters) {
    const dist = computeSemesterDistribution(dataset, sem, { scaleMax });
    if (!dist.insufficientData && dist.observationCount >= 4 && dist.boxplot) {
      const { q1, q3, iqr, lowerWhisker, upperWhisker, outliers } = dist.boxplot;
      for (const o of outliers) {
        candidates.push({
          candidateId: `SEM_${sem}_${o.student_key}`,
          student_key: o.student_key,
          type: "SEMESTER_SGPA_OUTLIER",
          context: `Semester ${sem} Distribution`,
          observedValue: o.sgpa,
          metricUnit: "SGPA",
          lowerThreshold: lowerWhisker,
          upperThreshold: upperWhisker,
          q1,
          q3,
          iqr,
          deviation: o.deviation,
          severity: o.position === "LOW" ? "LOW_OUTLIER" : "HIGH_OUTLIER",
          explanation: `SGPA ${o.sgpa.toFixed(2)} is outside the Tukey boxplot whiskers [${lowerWhisker.toFixed(2)}, ${upperWhisker.toFixed(2)}] for Semester ${sem}.`,
          guidance: "Review candidate for data entry verification. Do NOT remove without external transcript audit."
        });
      }
    }
  }

  // 2. Evaluate Large Regression Residual Outliers
  const residualAnalysis = computeResidualAnalysis(dataset, { scaleMax });
  if (residualAnalysis.hasResiduals && residualAnalysis.count >= 4 && residualAnalysis.statistics) {
    const { median, q1, q3, iqr } = residualAnalysis.statistics;
    const lowerBound = median - 1.5 * iqr;
    const upperBound = median + 1.5 * iqr;

    for (const r of residualAnalysis.residuals) {
      if (r.residual < lowerBound || r.residual > upperBound) {
        candidates.push({
          candidateId: `RES_${r.from_semester}_${r.to_semester}_${r.student_key}`,
          student_key: r.student_key,
          type: "REGRESSION_RESIDUAL_OUTLIER",
          context: `Transition Sem ${r.from_semester} → Sem ${r.to_semester}`,
          observedValue: r.actual_sgpa,
          predictedValue: r.predicted_sgpa,
          residualValue: r.residual,
          metricUnit: "Residual SGPA",
          lowerThreshold: lowerBound,
          upperThreshold: upperBound,
          q1,
          q3,
          iqr,
          deviation: r.residual < lowerBound ? lowerBound - r.residual : r.residual - upperBound,
          severity: r.residual < lowerBound ? "LARGE_NEGATIVE_RESIDUAL" : "LARGE_POSITIVE_RESIDUAL",
          explanation: `In-sample residual of ${r.residual.toFixed(3)} deviates significantly from cohort transition trend (fitted \u015D = ${r.predicted_sgpa.toFixed(2)}, actual = ${r.actual_sgpa.toFixed(2)}).`,
          guidance: "Indicates an atypical semester trajectory change. Represents true historical behavior unless transcript entry was erroneous."
        });
      }
    }
  }

  return {
    detectionAvailable: true,
    totalCandidates: candidates.length,
    candidates,
    ruleDocumentation: "Tukey 1.5x IQR Rule evaluated independently across observed semester distributions (n >= 4) and in-sample regression residuals (n >= 4).",
    safetyNotice: "Flagged points are strictly review candidates. Gradivue never modifies, deletes, or excludes observations automatically."
  };
}

/**
 * Extracts and prepares historical temporal evaluation comparisons
 * using the Phase 5 temporal validator output.
 * 
 * @param {Array<{student_key: string, semester_no: number, sgpa: number}>} dataset 
 * @param {object} [options]
 * @returns {object} Temporal evaluation comparison summary and fold breakdown
 */
export function computeDashboardTemporalEvaluation(dataset, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : GPA_SCALE_MAX;

  if (!Array.isArray(dataset) || dataset.length === 0) {
    return {
      evaluationAvailable: false,
      status: "UNAVAILABLE_NO_DATASET",
      message: "No dataset available for temporal evaluation.",
      metrics: null,
      folds: []
    };
  }

  let evalResult;
  try {
    evalResult = evaluateTemporalFolds(dataset, { scaleMax });
  } catch (err) {
    return {
      evaluationAvailable: false,
      status: "EVALUATION_ERROR",
      message: `Temporal evaluation failed: ${err.message}`,
      metrics: null,
      folds: []
    };
  }

  if (evalResult.evaluation_status !== EVALUATION_STATUS.EVALUATED || evalResult.paired_comparison_count === 0) {
    return {
      evaluationAvailable: false,
      status: evalResult.evaluation_status,
      message: "Insufficient historical transitions across early folds to perform paired temporal validation. Regression requires earlier target semesters for expanding-window training.",
      metrics: null,
      folds: evalResult.folds || []
    };
  }

  const p = evalResult.pooled_summary;
  const regMae = p.paired_regression_mae;
  const baseMae = p.paired_baseline_mae;
  const regRmse = p.paired_regression_rmse;
  const baseRmse = p.paired_baseline_rmse;

  let conclusion = "MIXED";
  if (p.regression_beats_baseline) {
    conclusion = "REGRESSION_SUPERIOR";
  } else if (regMae > baseMae) {
    conclusion = "BASELINE_SUPERIOR";
  }

  return {
    evaluationAvailable: true,
    status: evalResult.evaluation_status,
    conclusion,
    pairedComparisonCount: evalResult.paired_comparison_count,
    totalEligibleTestTransitions: evalResult.total_eligible_test_transitions,
    coverage: {
      regressionCoveragePct: evalResult.regression_prediction_coverage_pct,
      baselineCoveragePct: evalResult.baseline_prediction_coverage_pct
    },
    foldsSummary: {
      totalFolds: evalResult.total_folds_count,
      successfulFolds: evalResult.successful_folds_count,
      skippedFolds: evalResult.skipped_folds_count,
      failedFolds: evalResult.failed_folds_count
    },
    pairedMetrics: {
      regressionMae: regMae,
      baselineMae: baseMae,
      deltaMaePct: p.delta_mae_pct,
      regressionRmse: regRmse,
      baselineRmse: baseRmse,
      deltaRmsePct: p.delta_rmse_pct,
      regressionBeatsBaseline: p.regression_beats_baseline
    },
    overallBaseline: {
      overallMae: p.overall_baseline_mae,
      overallRmse: p.overall_baseline_rmse
    },
    folds: evalResult.folds.map(f => ({
      targetSemester: f.target_semester,
      status: f.regression_status,
      trainingCount: f.training_transition_count,
      testCount: f.test_transition_count,
      pairedCount: f.paired_comparison_count,
      regressionMae: f.regression_mae,
      baselineMae: f.baseline_mae,
      regressionRmse: f.regression_rmse,
      baselineRmse: f.baseline_rmse,
      deltaMaePct: f.delta_mae_pct,
      failureReason: f.failure_reason
    }))
  };
}
