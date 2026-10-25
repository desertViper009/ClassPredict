/**
 * @file temporal_validator.js
 * @description Rolling-origin temporal validation and model evaluation engine.
 * Evaluates Class-Wide Linear Regression against the Persistence Baseline using
 * an expanding training window to strictly eliminate future-to-past temporal leakage.
 * Pure mathematical computation layer completely decoupled from DOM and UI rendering.
 * Document Reference: docs/NUMERICAL_MODEL.md, docs/VALIDATION_AND_TESTING.md, docs/REQUIREMENTS.md (FR-08, NFR-05)
 */

import { isAllFinite } from './math_utils.js';
import { 
  buildConsecutiveTransitions, 
  predictPersistence, 
  fitTransitionRegression, 
  DEFAULT_SCALE_MAX,
  MIN_PREDICTOR_VARIANCE 
} from './regression_engine.js';

export const FOLD_STATUS = {
  EVALUATED: "EVALUATED",
  INSUFFICIENT_TRAINING_DATA: "INSUFFICIENT_TRAINING_DATA",
  FIT_FAILED: "FIT_FAILED",
  SKIPPED_NO_TEST_DATA: "SKIPPED_NO_TEST_DATA"
};

export const EVALUATION_STATUS = {
  EVALUATED: "EVALUATED",
  INSUFFICIENT_DATA_FOR_REGRESSION_EVALUATION: "INSUFFICIENT_DATA_FOR_REGRESSION_EVALUATION",
  UNAVAILABLE_NO_TRANSITIONS: "UNAVAILABLE_NO_TRANSITIONS"
};

/**
 * Validates actual and predicted arrays for metric computation.
 * @param {number[]} actual 
 * @param {number[]} predicted 
 * @throws {Error} If arrays are invalid, empty, length-mismatched, or contain non-finite numbers.
 */
function validateMetricArrays(actual, predicted) {
  if (!Array.isArray(actual) || !Array.isArray(predicted)) {
    throw new Error("Metric inputs must be arrays.");
  }
  if (actual.length === 0) {
    throw new Error("Evaluation array cannot be empty.");
  }
  if (actual.length !== predicted.length) {
    throw new Error(`Array length mismatch: actual has ${actual.length} elements, predicted has ${predicted.length} elements.`);
  }
  if (!isAllFinite(actual) || !isAllFinite(predicted)) {
    throw new Error("Evaluation arrays contain non-finite values (NaN or Infinity).");
  }
}

/**
 * Computes the Mean Absolute Error (MAE):
 *   MAE = (1 / n) * sum(|actual_i - predicted_i|)
 * 
 * @param {number[]} actual - Ground-truth target values
 * @param {number[]} predicted - Forecasted values
 * @returns {number} Mean Absolute Error in SGPA units
 */
export function computeMae(actual, predicted) {
  validateMetricArrays(actual, predicted);
  let sum = 0;
  for (let i = 0; i < actual.length; i++) {
    sum += Math.abs(actual[i] - predicted[i]);
  }
  return sum / actual.length;
}

/**
 * Computes the Root Mean Squared Error (RMSE):
 *   RMSE = sqrt((1 / n) * sum((actual_i - predicted_i)^2))
 * 
 * @param {number[]} actual - Ground-truth target values
 * @param {number[]} predicted - Forecasted values
 * @returns {number} Root Mean Squared Error in SGPA units
 */
export function computeRmse(actual, predicted) {
  validateMetricArrays(actual, predicted);
  let sumSq = 0;
  for (let i = 0; i < actual.length; i++) {
    const diff = actual[i] - predicted[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq / actual.length);
}

/**
 * Executes Rolling-Origin Temporal Cross-Validation on a cohort dataset.
 * 
 * Chronological Expanding-Window Rules:
 * For each target semester t:
 *   1. Training set: All valid consecutive transitions where to_semester < t.
 *      (Strictly earlier target semesters: max(training target semester) < t).
 *   2. Test set: All valid transitions where to_semester === t.
 *   3. If training transitions count < minTrainingSamples, the regression fold is skipped.
 *   4. If regression fit fails (e.g., zero variance), the failure reason is recorded explicitly.
 *   5. Persistence Baseline (s_{t-1}) is evaluated across all test transitions regardless of regression status.
 *   6. Paired model comparison is computed strictly over identical test transitions where both models predicted.
 *   7. Pooled metrics are calculated directly from pooled prediction records (never by averaging fold MAEs/RMSEs).
 * 
 * @param {Array<object>} dataset - Validated student records OR pre-built transitions array
 * @param {object} [options]
 * @param {number} [options.minTrainingSamples=2] - Minimum training transitions required to attempt regression
 * @param {number} [options.minPredictorVariance=MIN_PREDICTOR_VARIANCE] - Minimum predictor variance
 * @param {number} [options.scaleMax=DEFAULT_SCALE_MAX] - Configured maximum SGPA scale
 * @returns {object} Comprehensive temporal evaluation report
 */
export function evaluateTemporalFolds(dataset, options = {}) {
  const minTrainingSamples = typeof options.minTrainingSamples === 'number' && options.minTrainingSamples >= 2
    ? options.minTrainingSamples
    : 2;
  const minPredictorVariance = typeof options.minPredictorVariance === 'number'
    ? options.minPredictorVariance
    : MIN_PREDICTOR_VARIANCE;
  const scaleMax = typeof options.scaleMax === 'number'
    ? options.scaleMax
    : DEFAULT_SCALE_MAX;

  if (!Array.isArray(dataset)) {
    throw new Error("Invalid input: dataset must be an array.");
  }

  // 1. Resolve transitions from input (support raw validated records or pre-built transitions)
  let transitions = [];
  if (dataset.length > 0 && typeof dataset[0].from_semester === 'number' && typeof dataset[0].to_semester === 'number') {
    // Input is already transitions; deep clone to guarantee caller immutability
    transitions = dataset.map(t => ({ ...t }));
  } else if (dataset.length > 0) {
    // Input is raw student records; build consecutive transitions safely
    const transitionResult = buildConsecutiveTransitions(dataset, { scaleMax });
    transitions = transitionResult.transitions;
  }

  if (transitions.length === 0) {
    return {
      evaluation_status: EVALUATION_STATUS.UNAVAILABLE_NO_TRANSITIONS,
      message: "No valid consecutive-semester transitions available for temporal evaluation.",
      total_eligible_test_transitions: 0,
      folds: [],
      predictions: [],
      pooled_summary: null
    };
  }

  // 2. Identify all distinct target semesters in ascending chronological order
  const targetSemSet = new Set();
  for (let i = 0; i < transitions.length; i++) {
    targetSemSet.add(transitions[i].to_semester);
  }
  const targetSemesters = Array.from(targetSemSet).sort((a, b) => a - b);

  const folds = [];
  const predictions = [];

  // 3. Iterate chronologically over each target semester
  for (let sIdx = 0; sIdx < targetSemesters.length; sIdx++) {
    const t = targetSemesters[sIdx];

    // Strict Expanding Window: Training strictly uses to_semester < t
    const trainingTransitions = transitions.filter(tr => tr.to_semester < t);
    // Test transitions: Exactly to_semester === t
    const testTransitions = transitions.filter(tr => tr.to_semester === t);

    if (testTransitions.length === 0) {
      folds.push({
        target_semester: t,
        training_transition_count: trainingTransitions.length,
        test_transition_count: 0,
        regression_status: FOLD_STATUS.SKIPPED_NO_TEST_DATA,
        failure_reason: "No test transitions targeting semester " + t,
        fitted_model: null,
        baseline_mae: null,
        baseline_rmse: null,
        regression_mae: null,
        regression_rmse: null,
        delta_mae_pct: null,
        paired_comparison_count: 0
      });
      continue;
    }

    // Attempt regression model fitting
    let regressionStatus = FOLD_STATUS.EVALUATED;
    let failureReason = null;
    let fittedModel = null;

    if (trainingTransitions.length < minTrainingSamples) {
      regressionStatus = FOLD_STATUS.INSUFFICIENT_TRAINING_DATA;
      failureReason = `Insufficient training transitions targeting semesters < ${t} (available: ${trainingTransitions.length}, minimum required: ${minTrainingSamples}).`;
    } else {
      try {
        fittedModel = fitTransitionRegression(trainingTransitions, {
          scaleMax,
          minVariance: minPredictorVariance
        });
      } catch (err) {
        regressionStatus = FOLD_STATUS.FIT_FAILED;
        failureReason = err.message || "Linear regression fit failed.";
        fittedModel = null;
      }
    }

    // Evaluate test transitions
    const foldActuals = [];
    const foldBaselinePreds = [];
    const foldRegressionPreds = [];

    for (let i = 0; i < testTransitions.length; i++) {
      const tr = testTransitions[i];
      const actualSgpa = tr.next_sgpa;
      const prevSgpa = tr.previous_sgpa;

      // Evaluate Persistence Baseline: \hat{s}_t^{base} = s_{t-1}
      const baselineResult = predictPersistence(prevSgpa, { scaleMax });
      const persistencePred = baselineResult.rawPrediction;
      const baselineAbsError = Math.abs(actualSgpa - persistencePred);

      foldActuals.push(actualSgpa);
      foldBaselinePreds.push(persistencePred);

      // Evaluate Regression if model fitted successfully
      let regressionPred = null;
      let regressionAbsError = null;
      let regOutOfRange = false;

      if (regressionStatus === FOLD_STATUS.EVALUATED && fittedModel) {
        try {
          const regResult = fittedModel.predict(prevSgpa);
          if (typeof regResult.rawPrediction === 'number' && Number.isFinite(regResult.rawPrediction)) {
            regressionPred = regResult.rawPrediction;
            regOutOfRange = regResult.isOutOfRange;
            regressionAbsError = Math.abs(actualSgpa - regressionPred);
            foldRegressionPreds.push(regressionPred);
          } else {
            // Non-finite prediction encountered
            regressionPred = null;
          }
        } catch (_) {
          regressionPred = null;
        }
      }

      // Record prediction-level observation (privacy safe: pseudonymous keys only)
      predictions.push({
        student_key: tr.student_key,
        source_semester: tr.from_semester,
        target_semester: tr.to_semester,
        actual_sgpa: actualSgpa,
        persistence_prediction: persistencePred,
        baseline_abs_error: baselineAbsError,
        regression_prediction: regressionPred,
        regression_abs_error: regressionAbsError,
        regression_is_out_of_range: regOutOfRange,
        fold_status: regressionStatus
      });
    }

    // Fold metrics
    const baselineMae = computeMae(foldActuals, foldBaselinePreds);
    const baselineRmse = computeRmse(foldActuals, foldBaselinePreds);

    let regressionMae = null;
    let regressionRmse = null;
    let deltaMaePct = null;
    let pairedCount = 0;

    if (regressionStatus === FOLD_STATUS.EVALUATED && foldRegressionPreds.length === foldActuals.length) {
      regressionMae = computeMae(foldActuals, foldRegressionPreds);
      regressionRmse = computeRmse(foldActuals, foldRegressionPreds);
      pairedCount = foldActuals.length;
      if (baselineMae > 0) {
        deltaMaePct = ((baselineMae - regressionMae) / baselineMae) * 100;
      } else {
        deltaMaePct = 0;
      }
    }

    folds.push({
      target_semester: t,
      training_transition_count: trainingTransitions.length,
      test_transition_count: testTransitions.length,
      regression_status: regressionStatus,
      failure_reason: failureReason,
      fitted_model: fittedModel ? {
        a: fittedModel.coefficients.a,
        b: fittedModel.coefficients.b,
        formula: fittedModel.formula,
        sampleCount: fittedModel.sampleCount,
        predictorRange: fittedModel.predictorRange,
        predictorVariance: fittedModel.predictorVariance
      } : null,
      baseline_mae: baselineMae,
      baseline_rmse: baselineRmse,
      regression_mae: regressionMae,
      regression_rmse: regressionRmse,
      delta_mae_pct: deltaMaePct,
      paired_comparison_count: pairedCount
    });
  }

  // 4. Calculate Pooled Summary across all evaluated test predictions
  const totalEligible = predictions.length;
  const pairedRecords = predictions.filter(
    p => p.regression_prediction !== null && Number.isFinite(p.regression_prediction)
  );
  const pairedCount = pairedRecords.length;

  let pairedRegMae = null;
  let pairedRegRmse = null;
  let pairedBaseMae = null;
  let pairedBaseRmse = null;
  let deltaMaePct = null;
  let deltaRmsePct = null;
  let regressionBeatsBaseline = null;

  if (pairedCount > 0) {
    const pairedActuals = pairedRecords.map(p => p.actual_sgpa);
    const pairedRegPreds = pairedRecords.map(p => p.regression_prediction);
    const pairedBasePreds = pairedRecords.map(p => p.persistence_prediction);

    pairedRegMae = computeMae(pairedActuals, pairedRegPreds);
    pairedRegRmse = computeRmse(pairedActuals, pairedRegPreds);
    pairedBaseMae = computeMae(pairedActuals, pairedBasePreds);
    pairedBaseRmse = computeRmse(pairedActuals, pairedBasePreds);

    if (pairedBaseMae > 0) {
      deltaMaePct = ((pairedBaseMae - pairedRegMae) / pairedBaseMae) * 100;
    } else {
      deltaMaePct = 0;
    }

    if (pairedBaseRmse > 0) {
      deltaRmsePct = ((pairedBaseRmse - pairedRegRmse) / pairedBaseRmse) * 100;
    } else {
      deltaRmsePct = 0;
    }

    regressionBeatsBaseline = pairedRegMae < pairedBaseMae;
  }

  // Baseline evaluated across all test predictions
  const allActuals = predictions.map(p => p.actual_sgpa);
  const allBasePreds = predictions.map(p => p.persistence_prediction);
  const overallBaselineMae = computeMae(allActuals, allBasePreds);
  const overallBaselineRmse = computeRmse(allActuals, allBasePreds);

  // Fold aggregates
  const successfulFolds = folds.filter(f => f.regression_status === FOLD_STATUS.EVALUATED).length;
  const skippedFolds = folds.filter(
    f => f.regression_status === FOLD_STATUS.INSUFFICIENT_TRAINING_DATA || f.regression_status === FOLD_STATUS.SKIPPED_NO_TEST_DATA
  ).length;
  const failedFolds = folds.filter(f => f.regression_status === FOLD_STATUS.FIT_FAILED).length;

  const evaluationStatus = pairedCount > 0
    ? EVALUATION_STATUS.EVALUATED
    : EVALUATION_STATUS.INSUFFICIENT_DATA_FOR_REGRESSION_EVALUATION;

  return {
    evaluation_status: evaluationStatus,
    total_eligible_test_transitions: totalEligible,
    paired_comparison_count: pairedCount,
    baseline_prediction_coverage_pct: totalEligible > 0 ? 100.0 : 0.0,
    regression_prediction_coverage_pct: totalEligible > 0 ? (pairedCount / totalEligible) * 100.0 : 0.0,
    successful_folds_count: successfulFolds,
    skipped_folds_count: skippedFolds,
    failed_folds_count: failedFolds,
    total_folds_count: folds.length,
    pooled_summary: {
      paired_regression_mae: pairedRegMae,
      paired_regression_rmse: pairedRegRmse,
      paired_baseline_mae: pairedBaseMae,
      paired_baseline_rmse: pairedBaseRmse,
      delta_mae_pct: deltaMaePct,
      delta_rmse_pct: deltaRmsePct,
      regression_beats_baseline: regressionBeatsBaseline,
      overall_baseline_mae: overallBaselineMae,
      overall_baseline_rmse: overallBaselineRmse
    },
    folds,
    predictions
  };
}
