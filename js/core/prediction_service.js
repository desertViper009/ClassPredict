/**
 * @file prediction_service.js
 * @description Application service for individual and whole-class SGPA predictions,
 * model-status evaluation context, and privacy-preserving CSV export.
 * Pure service layer decoupled from DOM and UI rendering.
 * Document Reference: docs/REQUIREMENTS.md (FR-03, FR-04), docs/NUMERICAL_MODEL.md
 */

import { 
  DEFAULT_SCALE_MAX, 
  MIN_PREDICTOR_VARIANCE,
  buildConsecutiveTransitions, 
  fitTransitionRegression, 
  predictPersistence, 
  fitIndividualTrend 
} from './regression_engine.js';
import { evaluateTemporalFolds } from './temporal_validator.js';

export const PREDICTION_MODELS = {
  INDIVIDUAL_TREND: "INDIVIDUAL_TREND",
  SHARED_REGRESSION: "SHARED_REGRESSION",
  PERSISTENCE: "PERSISTENCE"
};

export const PREDICTION_STATUS = {
  PREDICTED: "PREDICTED",
  MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
  INSUFFICIENT_HISTORY: "INSUFFICIENT_HISTORY",
  OUT_OF_RANGE: "OUT_OF_RANGE"
};

/**
 * Validates and sorts a student's observed semester history.
 * @param {Array<{semester_no: number, sgpa: number}>} observations 
 * @param {number} scaleMax 
 * @returns {Array<{semester_no: number, sgpa: number}>} Sorted observations
 */
function validateAndSortObservations(observations, scaleMax) {
  if (!Array.isArray(observations)) {
    throw new Error("Observations must be an array.");
  }

  const n = observations.length;
  if (n < 3 || n > 7) {
    throw new Error(`History requires between 3 and 7 observed semesters (found ${n}).`);
  }

  const seen = new Set();
  const cleaned = [];

  for (let i = 0; i < n; i++) {
    const o = observations[i];
    if (!o || typeof o !== 'object') {
      throw new Error(`Observation at index ${i} is not a valid object.`);
    }

    const sem = Number(o.semester_no);
    if (!Number.isInteger(sem) || sem < 1 || sem > 12) {
      throw new Error(`Observation at index ${i} contains an invalid semester_no (must be integer 1-12).`);
    }

    const sgpa = Number(o.sgpa);
    if (!Number.isFinite(sgpa) || sgpa < 0.00 || sgpa > scaleMax) {
      throw new Error(`Observation at index ${i} contains out-of-scale or non-finite sgpa (must be 0.00-${scaleMax.toFixed(2)}).`);
    }

    if (seen.has(sem)) {
      throw new Error(`Duplicate semester number ${sem} detected in individual history.`);
    }
    seen.add(sem);

    cleaned.push({ semester_no: sem, sgpa });
  }

  // Sort chronologically ascending
  cleaned.sort((a, b) => a.semester_no - b.semester_no);
  return cleaned;
}

/**
 * Generates an individual next-semester SGPA prediction for a student.
 * 
 * Supported Models:
 * 1. INDIVIDUAL_TREND: Fits trend line s_k = a + b*k over student's 3-7 observed semesters.
 * 2. SHARED_REGRESSION: Uses cohort transition model s_{t+1} = a + b*s_t with student's latest SGPA.
 * 3. PERSISTENCE: Baseline forecast assuming s_{t+1} = s_t.
 * 
 * @param {Array<{semester_no: number, sgpa: number}>} observations - 3 to 7 observations
 * @param {object} [options]
 * @param {string} [options.model="INDIVIDUAL_TREND"] - Selected prediction model
 * @param {object} [options.sharedModel=null] - Pre-fitted class-wide model (if available)
 * @param {number} [options.scaleMax=DEFAULT_SCALE_MAX]
 * @param {number} [options.minVariance=MIN_PREDICTOR_VARIANCE]
 * @returns {object} Individual prediction result object
 */
export function predictIndividualStudent(observations, options = {}) {
  const modelType = options.model || PREDICTION_MODELS.INDIVIDUAL_TREND;
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : DEFAULT_SCALE_MAX;
  const minVariance = typeof options.minVariance === 'number' ? options.minVariance : MIN_PREDICTOR_VARIANCE;

  // Validate and sort observations (3-7 semesters)
  const cleaned = validateAndSortObservations(observations, scaleMax);
  const n = cleaned.length;
  const latestObs = cleaned[n - 1];
  const kLatest = latestObs.semester_no;
  const sLatest = latestObs.sgpa;
  const kTarget = kLatest + 1;

  if (modelType === PREDICTION_MODELS.INDIVIDUAL_TREND) {
    const trendResult = fitIndividualTrend(cleaned, { scaleMax, minVariance });
    return {
      modelId: "MODEL_C_INDIVIDUAL_TREND",
      modelName: "Individual Least-Squares Trend",
      coefficients: trendResult.coefficients,
      formula: trendResult.formula,
      targetSemester: trendResult.targetSemester,
      latestSemester: trendResult.latestSemester,
      latestSgpa: trendResult.latestSgpa,
      rawPrediction: trendResult.rawPrediction,
      isOutOfRange: trendResult.isOutOfRange,
      observationCount: trendResult.observationCount,
      degreesOfFreedom: trendResult.degreesOfFreedom,
      tCritical: trendResult.tCritical,
      volatilityWarning: trendResult.volatilityWarning,
      explanation: `Fitted linear trend across ${trendResult.observationCount} observed semesters (nu = ${trendResult.degreesOfFreedom} degrees of freedom). Extrapolated to semester ${trendResult.targetSemester}.`,
      status: PREDICTION_STATUS.PREDICTED,
      statusReason: null,
      sortedObservations: cleaned
    };
  }

  if (modelType === PREDICTION_MODELS.PERSISTENCE) {
    const baselineResult = predictPersistence(sLatest, { scaleMax });
    return {
      modelId: "MODEL_A_PERSISTENCE",
      modelName: "Persistence Baseline",
      targetSemester: kTarget,
      latestSemester: kLatest,
      latestSgpa: sLatest,
      rawPrediction: baselineResult.rawPrediction,
      isOutOfRange: baselineResult.isOutOfRange,
      observationCount: n,
      degreesOfFreedom: null,
      tCritical: null,
      volatilityWarning: null,
      explanation: `Naive baseline forecast assuming next semester's SGPA will exactly equal the latest observed SGPA (${sLatest.toFixed(2)}).`,
      status: PREDICTION_STATUS.PREDICTED,
      statusReason: null,
      sortedObservations: cleaned
    };
  }

  if (modelType === PREDICTION_MODELS.SHARED_REGRESSION) {
    const sharedModel = options.sharedModel;
    if (!sharedModel || typeof sharedModel.predict !== 'function') {
      return {
        modelId: "MODEL_B_LINEAR_REGRESSION",
        modelName: "Class-Wide Linear Regression",
        targetSemester: kTarget,
        latestSemester: kLatest,
        latestSgpa: sLatest,
        rawPrediction: null,
        isOutOfRange: false,
        observationCount: n,
        trainingTransitionCount: 0,
        degreesOfFreedom: null,
        tCritical: null,
        volatilityWarning: null,
        explanation: "Class-wide linear regression model is not available. Please load and accept a cohort dataset to fit the shared transition model.",
        status: PREDICTION_STATUS.MODEL_UNAVAILABLE,
        statusReason: "No fitted class-wide regression model available in session.",
        sortedObservations: cleaned
      };
    }

    const regResult = sharedModel.predict(sLatest);
    return {
      modelId: "MODEL_B_LINEAR_REGRESSION",
      modelName: "Class-Wide Linear Regression",
      targetSemester: kTarget,
      latestSemester: kLatest,
      latestSgpa: sLatest,
      rawPrediction: regResult.rawPrediction,
      isOutOfRange: regResult.isOutOfRange,
      observationCount: n,
      trainingTransitionCount: sharedModel.sampleCount,
      degreesOfFreedom: null,
      tCritical: null,
      volatilityWarning: null,
      explanation: `Evaluated using class-wide transition model fitted on ${sharedModel.sampleCount} consecutive cohort transitions (${sharedModel.formula}). Predictor: latest observed SGPA (${sLatest.toFixed(2)}).`,
      status: PREDICTION_STATUS.PREDICTED,
      statusReason: null,
      sortedObservations: cleaned
    };
  }

  throw new Error(`Unsupported prediction model: ${modelType}`);
}

/**
 * Fits the class-wide model and computes whole-class predictions for every student in an accepted dataset.
 * 
 * @param {Array<object>} dataset - Validated cohort records { student_key, semester_no, sgpa }
 * @param {object} [options]
 * @param {number} [options.scaleMax=DEFAULT_SCALE_MAX]
 * @param {number} [options.minVariance=MIN_PREDICTOR_VARIANCE]
 * @returns {object} Whole-class prediction result and evaluation context
 */
export function predictWholeClass(dataset, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : DEFAULT_SCALE_MAX;
  const minVariance = typeof options.minVariance === 'number' ? options.minVariance : MIN_PREDICTOR_VARIANCE;

  if (!Array.isArray(dataset) || dataset.length === 0) {
    return {
      status: "EMPTY_DATASET",
      students: [],
      sharedModel: null,
      sharedModelStatus: "NO_DATASET",
      sharedModelError: "No accepted cohort dataset available.",
      transitionsCount: 0,
      temporalSummary: null,
      summaryCounts: {
        totalStudents: 0,
        predictedCount: 0,
        outOfRangeCount: 0,
        unavailableCount: 0
      }
    };
  }

  // 1. Build consecutive transitions from dataset
  const { transitions } = buildConsecutiveTransitions(dataset, { scaleMax });
  const transitionsCount = transitions.length;

  let sharedModel = null;
  let sharedModelStatus = "UNAVAILABLE";
  let sharedModelError = null;

  if (transitionsCount < 2) {
    sharedModelStatus = "INSUFFICIENT_TRANSITIONS";
    sharedModelError = `Fewer than 2 valid consecutive transitions found (${transitionsCount}). Insufficient data to fit class-wide model.`;
  } else {
    try {
      sharedModel = fitTransitionRegression(transitions, { scaleMax, minVariance });
      sharedModelStatus = "FITTED";
    } catch (err) {
      sharedModelStatus = "FIT_FAILED";
      sharedModelError = err.message || "Failed to fit linear regression on transitions.";
      sharedModel = null;
    }
  }

  // 2. Compute historical temporal evaluation for model context
  let temporalSummary = null;
  try {
    const evalRes = evaluateTemporalFolds(dataset, { scaleMax, minPredictorVariance: minVariance });
    if (evalRes && evalRes.pooled_summary && evalRes.paired_comparison_count > 0) {
      temporalSummary = {
        evaluationStatus: evalRes.evaluation_status,
        pairedComparisonCount: evalRes.paired_comparison_count,
        pairedRegressionMae: evalRes.pooled_summary.paired_regression_mae,
        pairedRegressionRmse: evalRes.pooled_summary.paired_regression_rmse,
        pairedBaselineMae: evalRes.pooled_summary.paired_baseline_mae,
        pairedBaselineRmse: evalRes.pooled_summary.paired_baseline_rmse,
        deltaMaePct: evalRes.pooled_summary.delta_mae_pct,
        regressionBeatsBaseline: evalRes.pooled_summary.regression_beats_baseline,
        warning: evalRes.pooled_summary.regression_beats_baseline === false
          ? `Historical Holdout Warning: On historical validation folds, Class-Wide Linear Regression did NOT outperform the Persistence Baseline (Regression MAE: ${evalRes.pooled_summary.paired_regression_mae.toFixed(4)}, Baseline MAE: ${evalRes.pooled_summary.paired_baseline_mae.toFixed(4)}). Regression predictions should be interpreted with caution.`
          : null
      };
    }
  } catch (_) {
    temporalSummary = null;
  }

  // 3. Generate predictions per student
  const studentMap = new Map();
  for (let i = 0; i < dataset.length; i++) {
    const r = dataset[i];
    if (!studentMap.has(r.student_key)) {
      studentMap.set(r.student_key, []);
    }
    studentMap.get(r.student_key).push({
      semester_no: Number(r.semester_no),
      sgpa: Number(r.sgpa)
    });
  }

  const studentPredictions = [];
  studentMap.forEach((records, studentKey) => {
    records.sort((a, b) => a.semester_no - b.semester_no);
    const latest = records[records.length - 1];
    const kLatest = latest.semester_no;
    const sLatest = latest.sgpa;
    const kTarget = kLatest + 1;

    // Baseline forecast is always available
    const baselinePred = sLatest;

    let predictedSgpa = null;
    let isOutOfRange = false;
    let status = PREDICTION_STATUS.PREDICTED;
    let statusReason = null;

    if (sharedModel) {
      try {
        const predRes = sharedModel.predict(sLatest);
        predictedSgpa = predRes.rawPrediction;
        isOutOfRange = predRes.isOutOfRange;
        status = isOutOfRange ? PREDICTION_STATUS.OUT_OF_RANGE : PREDICTION_STATUS.PREDICTED;
      } catch (err) {
        status = PREDICTION_STATUS.MODEL_UNAVAILABLE;
        statusReason = err.message;
        predictedSgpa = null;
      }
    } else {
      status = PREDICTION_STATUS.MODEL_UNAVAILABLE;
      statusReason = sharedModelError || "Class-wide model unavailable";
      predictedSgpa = null;
    }

    studentPredictions.push({
      student_key: studentKey,
      observed_semesters_count: records.length,
      latest_semester: kLatest,
      latest_sgpa: sLatest,
      target_semester: kTarget,
      predicted_sgpa: predictedSgpa,
      baseline_prediction: baselinePred,
      model_name: sharedModel ? "Class-Wide Linear Regression" : "None",
      prediction_status: status,
      status_reason: statusReason,
      out_of_range: isOutOfRange
    });
  });

  // Sort students deterministically by student_key ASC
  studentPredictions.sort((a, b) => a.student_key.localeCompare(b.student_key));

  const totalStudents = studentPredictions.length;
  const predictedCount = studentPredictions.filter(s => s.prediction_status === PREDICTION_STATUS.PREDICTED || s.prediction_status === PREDICTION_STATUS.OUT_OF_RANGE).length;
  const outOfRangeCount = studentPredictions.filter(s => s.out_of_range).length;
  const unavailableCount = studentPredictions.filter(s => s.prediction_status === PREDICTION_STATUS.MODEL_UNAVAILABLE).length;

  return {
    status: "SUCCESS",
    students: studentPredictions,
    sharedModel: sharedModel ? {
      coefficients: sharedModel.coefficients,
      formula: sharedModel.formula,
      sampleCount: sharedModel.sampleCount,
      predictorRange: sharedModel.predictorRange
    } : null,
    sharedModelStatus,
    sharedModelError,
    transitionsCount,
    temporalSummary,
    summaryCounts: {
      totalStudents,
      predictedCount,
      outOfRangeCount,
      unavailableCount
    }
  };
}

/**
 * Helper to sanitize CSV text cells against formula injection (CWE-1236 / OWASP)
 * and enforce RFC-4180 quotation and quote-escaping.
 * 
 * @param {string|any} val 
 * @returns {string} Sanitized quoted cell
 */
export function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Neutralize formula triggers: =, +, -, @, tab (\t), carriage return (\r)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generates an RFC-4180 compliant CSV string for whole-class predictions.
 * Strictly excludes names, roll numbers, or personal identifying information.
 * Unavailable predictions are represented as empty strings, never as zero.
 * 
 * @param {Array<object>} studentPredictions 
 * @returns {string} CSV text
 */
export function exportWholeClassCSV(studentPredictions) {
  if (!Array.isArray(studentPredictions)) {
    throw new Error("Student predictions must be an array.");
  }

  const headers = [
    "student_key",
    "latest_semester",
    "latest_sgpa",
    "target_semester",
    "predicted_sgpa",
    "baseline_prediction",
    "model_name",
    "prediction_status",
    "out_of_range"
  ];

  const rows = [headers.join(",")];

  for (let i = 0; i < studentPredictions.length; i++) {
    const s = studentPredictions[i];
    const key = sanitizeCsvCell(s.student_key || '');
    const latestSem = s.latest_semester !== undefined ? s.latest_semester : '';
    const latestSgpa = typeof s.latest_sgpa === 'number' && Number.isFinite(s.latest_sgpa)
      ? s.latest_sgpa.toFixed(4)
      : '';
    const targetSem = s.target_semester !== undefined ? s.target_semester : '';
    const predictedSgpa = typeof s.predicted_sgpa === 'number' && Number.isFinite(s.predicted_sgpa)
      ? s.predicted_sgpa.toFixed(4)
      : '';
    const baselinePred = typeof s.baseline_prediction === 'number' && Number.isFinite(s.baseline_prediction)
      ? s.baseline_prediction.toFixed(4)
      : '';
    const modelName = sanitizeCsvCell(s.model_name || '');
    const status = sanitizeCsvCell(s.prediction_status || '');
    const outOfRange = s.out_of_range ? "TRUE" : "FALSE";

    rows.push([
      key,
      latestSem,
      latestSgpa,
      targetSem,
      predictedSgpa,
      baselinePred,
      modelName,
      status,
      outOfRange
    ].join(","));
  }

  return rows.join("\r\n");
}

/**
 * Generates an RFC-4180 compliant CSV string for an individual student prediction.
 * 
 * @param {object} individualResult 
 * @returns {string} CSV text
 */
export function exportIndividualCSV(individualResult) {
  if (!individualResult || typeof individualResult !== 'object') {
    throw new Error("Invalid individual result object.");
  }

  const rawPred = typeof individualResult.rawPrediction === 'number' && Number.isFinite(individualResult.rawPrediction)
    ? individualResult.rawPrediction.toFixed(4)
    : '';

  const safeModelName = sanitizeCsvCell(individualResult.modelName || '');

  const metaRows = [
    `# Gradivue Individual Prediction Result`,
    `# Target Semester,Predicted SGPA,Model Name,Latest Semester,Latest SGPA,Out Of Range`,
    `${individualResult.targetSemester},${rawPred},${safeModelName},${individualResult.latestSemester},${individualResult.latestSgpa.toFixed(4)},${individualResult.isOutOfRange ? "TRUE" : "FALSE"}`,
    ``,
    `semester_no,sgpa`
  ];

  if (Array.isArray(individualResult.sortedObservations)) {
    for (const o of individualResult.sortedObservations) {
      metaRows.push(`${o.semester_no},${Number(o.sgpa).toFixed(4)}`);
    }
  }

  return metaRows.join("\r\n");
}
