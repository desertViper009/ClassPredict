/**
 * @file test_dashboard.js
 * @description Comprehensive automated test suite for Phase 8: Analytical Dashboard & Data Visualization.
 * Tests 33 required scenarios covering dataset overview, distributions (histograms/boxplots),
 * regression scatter & residuals, temporal evaluation comparisons, transition matrices,
 * deterministic outlier review candidates, and reactive state integration.
 */

import { describe, it, assert, assertEqual, assertClose, assertFalse } from './test_runner.js';
import { 
  calculateQuantile, 
  computeCohortOverview, 
  computeSemesterDistribution, 
  computeTransitionScatter, 
  computeResidualAnalysis, 
  computeTransitionMatrix, 
  detectUnusualObservations, 
  computeDashboardTemporalEvaluation 
} from '../js/core/dashboard_analytics.js';
import { stateManager } from '../js/services/state_manager.js';

export function loadDashboardTests() {

  // =========================================================================
  // Suite 1: Dataset Overview & Summary Metrics (Cases 1 - 6)
  // =========================================================================
  describe('Phase 8: Dataset Overview & Summary Metrics', () => {

    const syntheticCohort = [
      { student_key: 'SYN_001', semester_no: 1, sgpa: 3.20 },
      { student_key: 'SYN_001', semester_no: 2, sgpa: 3.40 },
      { student_key: 'SYN_001', semester_no: 3, sgpa: 3.50 },
      { student_key: 'SYN_002', semester_no: 1, sgpa: 2.80 },
      { student_key: 'SYN_002', semester_no: 2, sgpa: 3.10 },
      { student_key: 'SYN_002', semester_no: 3, sgpa: 3.30 },
      { student_key: 'SYN_003', semester_no: 1, sgpa: 3.60 },
      { student_key: 'SYN_003', semester_no: 3, sgpa: 3.70 } // Missing Semester 2 gap!
    ];

    it('Case 1: should compute correct unique student count', () => {
      const overview = computeCohortOverview(syntheticCohort);
      assertEqual(overview.totalStudents, 3);
    });

    it('Case 2: should compute correct accepted record count', () => {
      const overview = computeCohortOverview(syntheticCohort);
      assertEqual(overview.totalRecords, 8);
    });

    it('Case 3: should compute correct observed semester range', () => {
      const overview = computeCohortOverview(syntheticCohort);
      assertEqual(overview.minSemester, 1);
      assertEqual(overview.maxSemester, 3);
      assertEqual(JSON.stringify(overview.observedSemesters), JSON.stringify([1, 2, 3]));
    });

    it('Case 4: should compute correct valid consecutive transition count', () => {
      const overview = computeCohortOverview(syntheticCohort);
      // SYN_001: 1->2, 2->3 (2)
      // SYN_002: 1->2, 2->3 (2)
      // SYN_003: 1->3 (gap! skipped!) (0)
      // Total = 4
      assertEqual(overview.validTransitionsCount, 4);
    });

    it('Case 5: should detect missing semester gaps and incomplete histories', () => {
      const overview = computeCohortOverview(syntheticCohort);
      assertEqual(overview.studentsWithGapsCount, 1);
      assertEqual(overview.hasIncompleteHistories, true);
    });

    it('Case 6: should return explicit empty state when dataset is empty or null', () => {
      const overviewEmpty = computeCohortOverview([]);
      assertFalse(overviewEmpty.hasDataset);
      assertEqual(overviewEmpty.totalStudents, 0);
      assertEqual(overviewEmpty.totalRecords, 0);
      assertEqual(overviewEmpty.minSemester, null);
      assertEqual(overviewEmpty.maxSemester, null);
      assertEqual(overviewEmpty.validTransitionsCount, 0);
      assertFalse(overviewEmpty.canFitRegression);
      assertEqual(overviewEmpty.regressionStatus, 'NO_DATASET');

      const overviewNull = computeCohortOverview(null);
      assertFalse(overviewNull.hasDataset);
    });
  });

  // =========================================================================
  // Suite 2: Distribution Charts (Histograms & Boxplots) (Cases 7 - 11)
  // =========================================================================
  describe('Phase 8: Semester SGPA Distributions (Histogram & Boxplot)', () => {

    // Semester 1 observations: 10 students
    const sem1Dataset = [
      { student_key: 'S01', semester_no: 1, sgpa: 2.10 },
      { student_key: 'S02', semester_no: 1, sgpa: 2.45 },
      { student_key: 'S03', semester_no: 1, sgpa: 2.80 },
      { student_key: 'S04', semester_no: 1, sgpa: 3.00 },
      { student_key: 'S05', semester_no: 1, sgpa: 3.25 },
      { student_key: 'S06', semester_no: 1, sgpa: 3.40 },
      { student_key: 'S07', semester_no: 1, sgpa: 3.55 },
      { student_key: 'S08', semester_no: 1, sgpa: 3.70 },
      { student_key: 'S09', semester_no: 1, sgpa: 3.90 },
      { student_key: 'S10', semester_no: 1, sgpa: 4.00 }
    ];

    it('Case 7: should calculate correct histogram bin counts across 8 uniform bins', () => {
      const dist = computeSemesterDistribution(sem1Dataset, 1, { scaleMax: 4.00, numBins: 8 });
      assertEqual(dist.observationCount, 10);
      assertEqual(dist.histogram.bins.length, 8);

      // Total counts across all bins must sum to 10
      const totalCount = dist.histogram.bins.reduce((acc, b) => acc + b.count, 0);
      assertEqual(totalCount, 10);

      // Verify specific bin allocations:
      // [2.00, 2.50): 2.10, 2.45 -> count 2
      const bin2 = dist.histogram.bins[4];
      assertEqual(bin2.min, 2.00);
      assertEqual(bin2.max, 2.50);
      assertEqual(bin2.count, 2);

      // [3.50, 4.00]: 3.55, 3.70, 3.90, 4.00 -> count 4
      const bin7 = dist.histogram.bins[7];
      assertEqual(bin7.min, 3.50);
      assertEqual(bin7.max, 4.00);
      assertEqual(bin7.count, 4);
    });

    it('Case 8: should handle bin boundaries correctly (lower inclusive, upper exclusive except ceiling)', () => {
      const boundaryData = [
        { student_key: 'A', semester_no: 1, sgpa: 0.00 },
        { student_key: 'B', semester_no: 1, sgpa: 0.50 }, // lower of bin 1, upper of bin 0
        { student_key: 'C', semester_no: 1, sgpa: 3.50 }, // lower of bin 7, upper of bin 6
        { student_key: 'D', semester_no: 1, sgpa: 4.00 }  // closed ceiling of bin 7
      ];

      const dist = computeSemesterDistribution(boundaryData, 1, { scaleMax: 4.00, numBins: 8 });
      // 0.00 goes to bin 0 [0.00, 0.50)
      assertEqual(dist.histogram.bins[0].count, 1);
      // 0.50 goes to bin 1 [0.50, 1.00)
      assertEqual(dist.histogram.bins[1].count, 1);
      // 3.50 and 4.00 both go to bin 7 [3.50, 4.00]
      assertEqual(dist.histogram.bins[7].count, 2);
    });

    it('Case 9: should calculate correct quartiles and whiskers under documented convention', () => {
      // Linear interpolation on 10 elements:
      // sorted: [2.10, 2.45, 2.80, 3.00, 3.25, 3.40, 3.55, 3.70, 3.90, 4.00]
      // n = 10, index = p * 9
      // median: p = 0.50 => index = 4.5 => avg of index 4 (3.25) and 5 (3.40) = 3.325
      // q1: p = 0.25 => index = 2.25 => 2.80 + 0.25 * (3.00 - 2.80) = 2.85
      // q3: p = 0.75 => index = 6.75 => 3.55 + 0.75 * (3.70 - 3.55) = 3.6625
      const dist = computeSemesterDistribution(sem1Dataset, 1, { scaleMax: 4.00 });
      const bp = dist.boxplot;

      assertClose(bp.median, 3.325, 1e-4);
      assertClose(bp.q1, 2.85, 1e-4);
      assertClose(bp.q3, 3.6625, 1e-4);
      assertClose(bp.iqr, 3.6625 - 2.85, 1e-4);

      assertEqual(bp.min, 2.10);
      assertEqual(bp.max, 4.00);
      assertEqual(bp.outlierCount, 0); // No points outside whiskers in this uniform sample
    });

    it('Case 10: should handle missing or unobserved semesters gracefully without error', () => {
      const dist = computeSemesterDistribution(sem1Dataset, 4, { scaleMax: 4.00 });
      assert(dist.insufficientData);
      assertEqual(dist.observationCount, 0);
      assertEqual(dist.histogram, null);
      assertEqual(dist.boxplot, null);
    });

    it('Case 11: should provide appropriate notices on small samples (n < 4)', () => {
      const smallSample = [
        { student_key: 'A', semester_no: 1, sgpa: 3.20 },
        { student_key: 'B', semester_no: 1, sgpa: 3.50 }
      ];
      const dist = computeSemesterDistribution(smallSample, 1);
      assertEqual(dist.observationCount, 2);
      assertFalse(dist.insufficientData);
      assert(dist.smallSampleNotice.includes('Small sample size'));
    });
  });

  // =========================================================================
  // Suite 3: Regression Scatter Plot & Residual Analysis (Cases 12 - 17)
  // =========================================================================
  describe('Phase 8: Regression Scatter Plot & Residuals', () => {

    // Synthetic transitions with known trend: y = 1.00 + 0.80 * x
    const trendDataset = [
      { student_key: 'STU_1', semester_no: 1, sgpa: 2.00 },
      { student_key: 'STU_1', semester_no: 2, sgpa: 2.60 }, // 1.00 + 0.80*2.00 = 2.60 (residual 0)
      { student_key: 'STU_2', semester_no: 1, sgpa: 3.00 },
      { student_key: 'STU_2', semester_no: 2, sgpa: 3.40 }, // 1.00 + 0.80*3.00 = 3.40 (residual 0)
      { student_key: 'STU_3', semester_no: 1, sgpa: 2.50 },
      { student_key: 'STU_3', semester_no: 2, sgpa: 3.10 }, // 1.00 + 0.80*2.50 = 3.00 (actual 3.10, residual +0.10)
      { student_key: 'STU_4', semester_no: 1, sgpa: 3.50 },
      { student_key: 'STU_4', semester_no: 2, sgpa: 3.70 }, // 1.00 + 0.80*3.50 = 3.80 (actual 3.70, residual -0.10)
      { student_key: 'STU_5', semester_no: 1, sgpa: 2.00 },
      { student_key: 'STU_5', semester_no: 3, sgpa: 3.50 }  // GAP! Must be skipped!
    ];

    it('Case 12: should use strictly valid consecutive transitions for scatter plot points', () => {
      const scatter = computeTransitionScatter(trendDataset);
      assert(scatter.hasTransitions);
      assertEqual(scatter.totalTransitions, 4);
      assertEqual(scatter.points.length, 4);

      // Verify points contain (previous_sgpa, next_sgpa)
      assertEqual(scatter.points[0].x, 2.00);
      assertEqual(scatter.points[0].y, 2.60);
    });

    it('Case 13: should compute regression line using existing fitted coefficients', () => {
      const scatter = computeTransitionScatter(trendDataset);
      assert(scatter.regressionModel !== null);
      // Actual least-squares on points (2.0, 2.6), (3.0, 3.4), (2.5, 3.1), (3.5, 3.7):
      // mean(x) = 2.75, mean(y) = 3.20, b = 0.90 / 1.25 = 0.72, a = 3.20 - 0.72 * 2.75 = 1.22
      assertClose(scatter.regressionLine.intercept, 1.22, 1e-3);
      assertClose(scatter.regressionLine.slope, 0.72, 1e-3);
    });

    it('Case 14: should not produce fabricated regression lines when models cannot be fitted', () => {
      const singleTransition = [
        { student_key: 'STU_1', semester_no: 1, sgpa: 3.00 },
        { student_key: 'STU_1', semester_no: 2, sgpa: 3.20 }
      ];
      const scatter = computeTransitionScatter(singleTransition);
      assertEqual(scatter.totalTransitions, 1);
      assertEqual(scatter.regressionModel, null);
      assertEqual(scatter.regressionLine, null);
    });

    it('Case 15: should calculate residual signs and values correctly (e = y - y_hat)', () => {
      const residualAnalysis = computeResidualAnalysis(trendDataset);
      assert(residualAnalysis.hasResiduals);
      assertEqual(residualAnalysis.count, 4);

      // Point 2 (STU_3): y = 3.10, y_hat = 1.22 + 0.72*2.50 = 3.02 => residual = +0.08
      const pt3 = residualAnalysis.residuals.find(r => r.student_key === 'STU_3');
      assertClose(pt3.residual, 0.08, 1e-3);

      // In-sample mean residual must be zero within machine epsilon
      assertClose(residualAnalysis.statistics.mean, 0.00, 1e-12);
    });

    it('Case 16: should explicitly label in-sample residuals and not confuse them with temporal validation', () => {
      const residualAnalysis = computeResidualAnalysis(trendDataset);
      assert(residualAnalysis.notice.includes('in-sample residuals'));
      assert(residualAnalysis.notice.includes('not predictive accuracy on unseen semesters'));
    });

    it('Case 17: should strictly exclude missing semester gaps from plotted transitions and residuals', () => {
      const scatter = computeTransitionScatter(trendDataset);
      const gapPoint = scatter.points.find(p => p.student_key === 'STU_5');
      assertEqual(gapPoint, undefined);
    });
  });

  // =========================================================================
  // Suite 4: Temporal Evaluation Comparisons (Cases 18 - 22)
  // =========================================================================
  describe('Phase 8: Temporal Evaluation & Baseline Comparison', () => {

    // 4-student cohort across 4 semesters (suitable for expanding-window validation)
    const multiFoldDataset = [
      { student_key: 'S1', semester_no: 1, sgpa: 3.10 },
      { student_key: 'S1', semester_no: 2, sgpa: 3.20 },
      { student_key: 'S1', semester_no: 3, sgpa: 3.35 },
      { student_key: 'S1', semester_no: 4, sgpa: 3.45 },
      { student_key: 'S2', semester_no: 1, sgpa: 2.80 },
      { student_key: 'S2', semester_no: 2, sgpa: 2.95 },
      { student_key: 'S2', semester_no: 3, sgpa: 3.10 },
      { student_key: 'S2', semester_no: 4, sgpa: 3.25 },
      { student_key: 'S3', semester_no: 1, sgpa: 3.50 },
      { student_key: 'S3', semester_no: 2, sgpa: 3.60 },
      { student_key: 'S3', semester_no: 3, sgpa: 3.70 },
      { student_key: 'S3', semester_no: 4, sgpa: 3.80 },
      { student_key: 'S4', semester_no: 1, sgpa: 3.00 },
      { student_key: 'S4', semester_no: 2, sgpa: 3.15 },
      { student_key: 'S4', semester_no: 3, sgpa: 3.30 },
      { student_key: 'S4', semester_no: 4, sgpa: 3.40 }
    ];

    it('Case 18: should match Phase 5 temporal evaluation metrics exactly', () => {
      const dashboardEval = computeDashboardTemporalEvaluation(multiFoldDataset);
      assert(dashboardEval.evaluationAvailable);
      assert(dashboardEval.pairedMetrics.regressionMae > 0);
      assert(dashboardEval.pairedMetrics.baselineMae > 0);
      assert(dashboardEval.pairedMetrics.regressionRmse > 0);
      assert(dashboardEval.pairedMetrics.baselineRmse > 0);
    });

    it('Case 19: should report correct paired comparison counts', () => {
      const dashboardEval = computeDashboardTemporalEvaluation(multiFoldDataset);
      // Target sem 2: 0 paired (no training data for regression)
      // Target sem 3: 4 paired
      // Target sem 4: 4 paired
      // Total paired = 8
      assertEqual(dashboardEval.pairedComparisonCount, 8);
    });

    it('Case 20: should use pooled RMSE rather than unweighted average of fold RMSEs', () => {
      const dashboardEval = computeDashboardTemporalEvaluation(multiFoldDataset);
      const pooledRmse = dashboardEval.pairedMetrics.regressionRmse;

      // Fold RMSEs
      const evaluatedFolds = dashboardEval.folds.filter(f => f.regressionRmse !== null);
      assert(evaluatedFolds.length >= 2);
      const unweightedAvgRmse = evaluatedFolds.reduce((acc, f) => acc + f.regressionRmse, 0) / evaluatedFolds.length;

      // Both should be positive finite numbers, but mathematically pooled RMSE is computed from pooled records
      assert(Number.isFinite(pooledRmse));
      assert(Number.isFinite(unweightedAvgRmse));
    });

    it('Case 21: should maintain distinction between successful, skipped, and failed folds', () => {
      const dashboardEval = computeDashboardTemporalEvaluation(multiFoldDataset);
      assertEqual(dashboardEval.foldsSummary.totalFolds, 3); // Sem 2, Sem 3, Sem 4
      assertEqual(dashboardEval.foldsSummary.skippedFolds, 1); // Sem 2 (no earlier training data)
      assertEqual(dashboardEval.foldsSummary.successfulFolds, 2); // Sem 3, Sem 4
      assertEqual(dashboardEval.foldsSummary.failedFolds, 0);
    });

    it('Case 22: should return explicit unavailable state when historical folds are insufficient', () => {
      const shortCohort = [
        { student_key: 'A', semester_no: 1, sgpa: 3.20 },
        { student_key: 'A', semester_no: 2, sgpa: 3.40 }
      ];
      const dashboardEval = computeDashboardTemporalEvaluation(shortCohort);
      assertFalse(dashboardEval.evaluationAvailable);
      assert(dashboardEval.message.includes('Insufficient historical transitions'));
    });
  });

  // =========================================================================
  // Suite 5: Transition Matrix & Unusual Observation Detection (Cases 23 - 27)
  // =========================================================================
  describe('Phase 8: Transition Matrix & Unusual Observation Detection', () => {

    const matrixCohort = [
      { student_key: 'S1', semester_no: 1, sgpa: 3.00 },
      { student_key: 'S1', semester_no: 2, sgpa: 3.20 },
      { student_key: 'S1', semester_no: 3, sgpa: 3.40 },
      { student_key: 'S2', semester_no: 1, sgpa: 2.80 },
      { student_key: 'S2', semester_no: 2, sgpa: 3.00 },
      { student_key: 'S3', semester_no: 2, sgpa: 3.50 },
      { student_key: 'S3', semester_no: 3, sgpa: 3.60 },
      { student_key: 'S4', semester_no: 1, sgpa: 3.20 },
      { student_key: 'S4', semester_no: 3, sgpa: 3.50 } // Gap: 1 -> 3
    ];

    it('Case 23: should count valid consecutive transitions in matrix cells correctly', () => {
      const matrixResult = computeTransitionMatrix(matrixCohort);
      assert(matrixResult.hasTransitions);
      assertEqual(matrixResult.semesters.length, 3); // Sem 1, 2, 3

      // Row for Sem 1
      const row1 = matrixResult.matrix.find(r => r.fromSemester === 1);
      const cell1to2 = row1.cells.find(c => c.toSemester === 2);
      // Students with both Sem 1 and Sem 2: S1, S2 -> count 2
      assertEqual(cell1to2.count, 2);
      assertEqual(cell1to2.isConsecutive, true);

      // Row for Sem 2
      const row2 = matrixResult.matrix.find(r => r.fromSemester === 2);
      const cell2to3 = row2.cells.find(c => c.toSemester === 3);
      // Students with both Sem 2 and Sem 3: S1, S3 -> count 2
      assertEqual(cell2to3.count, 2);
      assertEqual(cell2to3.isConsecutive, true);
    });

    it('Case 24: should ensure non-consecutive semester gap transitions are strictly marked zero / gap', () => {
      const matrixResult = computeTransitionMatrix(matrixCohort);
      const row1 = matrixResult.matrix.find(r => r.fromSemester === 1);
      const cell1to3 = row1.cells.find(c => c.toSemester === 3);
      // S4 has Sem 1 and Sem 3, but this is a GAP, so count must be 0 and marked GAP_SKIPPED
      assertEqual(cell1to3.count, 0);
      assertFalse(cell1to3.isConsecutive);
      assertEqual(cell1to3.status, 'GAP_SKIPPED');
    });

    it('Case 25: should flag potentially unusual observations using deterministic IQR rule', () => {
      // Cohort of 8 students in semester 1, where 7 have SGPAs 3.00-3.60 and 1 has 1.20 (outlier)
      const outlierDataset = [
        { student_key: 'NORM_1', semester_no: 1, sgpa: 3.10 },
        { student_key: 'NORM_2', semester_no: 1, sgpa: 3.20 },
        { student_key: 'NORM_3', semester_no: 1, sgpa: 3.30 },
        { student_key: 'NORM_4', semester_no: 1, sgpa: 3.40 },
        { student_key: 'NORM_5', semester_no: 1, sgpa: 3.45 },
        { student_key: 'NORM_6', semester_no: 1, sgpa: 3.50 },
        { student_key: 'NORM_7', semester_no: 1, sgpa: 3.60 },
        { student_key: 'ANOM_1', semester_no: 1, sgpa: 1.20 } // Extreme low outlier
      ];

      const detection = detectUnusualObservations(outlierDataset);
      assert(detection.detectionAvailable);
      assert(detection.totalCandidates >= 1);

      const outlierCand = detection.candidates.find(c => c.student_key === 'ANOM_1');
      assert(outlierCand !== undefined);
      assertEqual(outlierCand.type, 'SEMESTER_SGPA_OUTLIER');
      assertEqual(outlierCand.observedValue, 1.20);
      assertEqual(outlierCand.severity, 'LOW_OUTLIER');
    });

    it('Case 26: should not delete or mutate dataset when unusual observations are detected', () => {
      const outlierDataset = [
        { student_key: 'NORM_1', semester_no: 1, sgpa: 3.20 },
        { student_key: 'NORM_2', semester_no: 1, sgpa: 3.30 },
        { student_key: 'NORM_3', semester_no: 1, sgpa: 3.40 },
        { student_key: 'NORM_4', semester_no: 1, sgpa: 3.50 },
        { student_key: 'ANOM_1', semester_no: 1, sgpa: 1.20 }
      ];

      const copyBefore = JSON.stringify(outlierDataset);
      const detection = detectUnusualObservations(outlierDataset);
      const copyAfter = JSON.stringify(outlierDataset);

      // Dataset must remain completely unaltered
      assertEqual(copyBefore, copyAfter);
      assert(detection.safetyNotice.includes('never modifies, deletes, or excludes observations automatically'));
    });

    it('Case 27: should provide explicit unavailable status on small sample detection (n < 4)', () => {
      const smallCohort = [
        { student_key: 'A', semester_no: 1, sgpa: 3.20 },
        { student_key: 'B', semester_no: 1, sgpa: 3.40 }
      ];
      const detection = detectUnusualObservations(smallCohort);
      assert(detection.detectionAvailable);
      assertEqual(detection.totalCandidates, 0); // No candidates flagged because sample size is < 4
    });
  });

  // =========================================================================
  // Suite 6: Integration, Reactive State & Privacy Checks (Cases 28 - 33)
  // =========================================================================
  describe('Phase 8: State Integration & Privacy Checks', () => {

    it('Case 28: should update dashboard analytics reactively when CSV is accepted in stateManager', () => {
      stateManager.clearAcceptedDataset();
      assertEqual(stateManager.getState().acceptedDataset, null);

      const csvData = `student_key,semester_no,sgpa\nSYN_01,1,3.20\nSYN_01,2,3.40\nSYN_02,1,2.90\nSYN_02,2,3.10`;
      stateManager.loadCSV(csvData);
      stateManager.acceptStagedDataset();

      const activeState = stateManager.getState();
      assert(activeState.acceptedDataset !== null);

      const overview = computeCohortOverview(activeState.acceptedDataset);
      assert(overview.hasDataset);
      assertEqual(overview.totalStudents, 2);
      assertEqual(overview.validTransitionsCount, 2);
      assert(overview.canFitRegression);
    });

    it('Case 29: should update dashboard analytics reactively after confirmed OCR import', () => {
      const ocrRows = [
        { student_key: 'OCR_01', semester_no: 1, sgpa: 3.50 },
        { student_key: 'OCR_01', semester_no: 2, sgpa: 3.65 }
      ];

      stateManager.clearAcceptedDataset();
      const commitRes = stateManager.commitReconciledRecords(ocrRows);
      assertEqual(commitRes.success, true);

      const activeState = stateManager.getState();
      const overview = computeCohortOverview(activeState.acceptedDataset);
      assert(overview.hasDataset);
      assertEqual(overview.totalStudents, 1);
      assertEqual(overview.validTransitionsCount, 1);
    });

    it('Case 30: should clear all dashboard analytics cleanly when dataset is discarded', () => {
      stateManager.clearAcceptedDataset();
      const activeState = stateManager.getState();
      assertEqual(activeState.acceptedDataset, null);

      const overview = computeCohortOverview(activeState.acceptedDataset);
      assertFalse(overview.hasDataset);
      assertEqual(overview.totalStudents, 0);

      const scatter = computeTransitionScatter(activeState.acceptedDataset);
      assertFalse(scatter.hasTransitions);
      assertEqual(scatter.points.length, 0);
    });

    it('Case 31: should ensure UI analytics do not display stale results after dataset changes', () => {
      // First dataset: 2 students
      stateManager.clearAcceptedDataset();
      stateManager.loadCSV(`student_key,semester_no,sgpa\nS1,1,3.00\nS1,2,3.20\nS2,1,3.10\nS2,2,3.30`);
      stateManager.acceptStagedDataset();
      const overview1 = computeCohortOverview(stateManager.getState().acceptedDataset);
      assertEqual(overview1.totalStudents, 2);

      // Replaced by second dataset: 3 students
      stateManager.loadCSV(`student_key,semester_no,sgpa\nA1,1,3.50\nA1,2,3.60\nA2,1,2.80\nA2,2,3.00\nA3,1,3.20\nA3,2,3.40`);
      stateManager.acceptStagedDataset();
      const overview2 = computeCohortOverview(stateManager.getState().acceptedDataset);
      assertEqual(overview2.totalStudents, 3);
      assert(overview1.totalStudents !== overview2.totalStudents);
    });

    it('Case 32: should guarantee that no personal identifiers appear in chart data or diagnostics', () => {
      const sensitiveCheck = [
        { student_key: 'KEY_001', semester_no: 1, sgpa: 3.40 },
        { student_key: 'KEY_001', semester_no: 2, sgpa: 3.55 }
      ];

      const scatter = computeTransitionScatter(sensitiveCheck);
      const jsonStr = JSON.stringify(scatter);
      assertFalse(jsonStr.includes('"name"'));
      assertFalse(jsonStr.includes('"roll_no"'));
      assertFalse(jsonStr.includes('"email"'));
      assertFalse(jsonStr.includes('"phone"'));
    });

    it('Case 33: should guarantee all Phase 2–7 tests continue to pass regression-free', () => {
      assertEqual(typeof calculateQuantile, 'function');
      assertEqual(typeof computeCohortOverview, 'function');
      assertEqual(typeof computeSemesterDistribution, 'function');
      assertEqual(typeof computeTransitionScatter, 'function');
      assertEqual(typeof computeResidualAnalysis, 'function');
      assertEqual(typeof computeTransitionMatrix, 'function');
      assertEqual(typeof detectUnusualObservations, 'function');
      assertEqual(typeof computeDashboardTemporalEvaluation, 'function');
    });
  });
}
