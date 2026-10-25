# Changelog — ClassPredict

All notable changes to the ClassPredict project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - October 2026 (Phase 10: Final Hardening, Production Deployment & Portfolio Release)

### Added
* **Production Service Worker & Offline Shell Caching (`sw.js`)**:
  - Implemented application shell caching (`classpredict-v1.0.0-static`) covering HTML, CSS, JavaScript modules, and sample CSV data.
  - Implemented network-first strategy for `index.html` navigation requests ensuring instantaneous updates when online.
  - Implemented cache-first strategy with network fallback for local static assets.
  - Enforced strict privacy caching guardrail: explicitly ignores and never caches blob URLs, file uploads, OCR text, or student records.
  - Added connection status indicator badge (`#net-status-badge`) in navigation header displaying `Online` (emerald) or `Offline Shell` (amber).
* **GitHub Actions Static Deployment Pipeline (`.github/workflows/deploy.yml`)**:
  - Configured reproducible automated static deployment workflow targeting GitHub Pages.
  - Integrated automated execution of `npm test` as a required deployment quality gate before uploading static artifacts.
* **Synthetic Demonstration Workflow & Edge Cases (`samples/sample_class_sgpa.csv`)**:
  - Enhanced synthetic demonstration dataset with 13 students (`SYN_001` to `SYN_013`) illustrating complete academic trajectory variety.
  - Added student `SYN_011` with non-consecutive semesters (1 & 3; missing 2) demonstrating missing semester gap detection and gap exclusion.
  - Added student `SYN_012` with a single semester demonstrating safe fallback to persistence baseline in cohort forecasting.
  - Added student `SYN_013` with a steep upward trend demonstrating unclipped raw mathematical extrapolation ($> 4.00$) and explicit out-of-range alert flagging.
  - Added interactive header trigger (`#btn-header-demo`) providing accessible explanation and one-click navigation to load synthetic demo records.
* **Production Release Hardening Test Suite (`tests/test_release_hardening.js`)**:
  - 10 automated test cases (`TC-REL-01` to `TC-REL-10`) verifying package configuration, Service Worker asset manifests, exclusion of local machine paths, enhanced synthetic CSV parsing, gap detection, single-semester handling, out-of-range unclipped predictions, discard state cleanup, educational lab immutability, and full regression integrity.
* **Comment-Tolerant CSV Schema Parser (`js/core/data_validator.js`)**:
  - Enhanced `validateAndNormalizeDataset` to gracefully filter out metadata and documentation comment rows starting with `#`, permitting academic header annotations in CSV datasets while preserving strict 3-column schema enforcement.

### Verified & Hardened
* Executed complete automated test suite (`npm test`):
  - Total Suites: 40
  - Total Tests: 226
  - Passed: 226
  - Failed: 0
  - Execution Time: ~60ms
* Verified zero machine-specific absolute paths across all HTML, CSS, and JS sources.
* Confirmed strict privacy boundary: zero student data transmission, zero persistent caching of academic records, and 100% client-side computation.
* **Public GitHub Release & GitHub Pages Deployment**:
  - Published public repository to GitHub: [https://github.com/desertViper009/ClassPredict](https://github.com/desertViper009/ClassPredict)
  - Successfully deployed live web application to GitHub Pages: [https://desertviper009.github.io/ClassPredict/](https://desertviper009.github.io/ClassPredict/)
  - Configured GitHub Actions static assembly workflow to isolate runtime assets (`_site`) with `.nojekyll`.

---

## [1.0.9] - October 2026 (Phase 9: Interactive Numerical Methods Educational Laboratory)

### Added
* **Trace-Enabled Gaussian Elimination Solver (`js/core/linear_algebra.js`)**:
  - Implemented `solveLinearSystemWithTrace(A, b, options)` sharing a unified `_gaussianElimination` engine with `solveLinearSystem`.
  - Records step-by-step augmented matrix $[A | \mathbf{b}]$ transformations, pivot candidate evaluations, scale-aware pivot checks, row swaps ($R_k \leftrightarrow R_p$), row multipliers $m_{ik} = a_{ik}/a_{kk}$, row operation formulas $R_i \leftarrow R_i - m_{ik} R_k$, back-substitution steps ($x_n$ down to $x_1$), and residual vector calculation $\mathbf{r} = \mathbf{b} - A\hat{\mathbf{x}}$ with Euclidean norm $\|\mathbf{r}\|_2$.
* **Educational Laboratory Calculation Engine (`js/core/numerical_lab.js`)**:
  - `runGaussianEliminationExperiment(A, b, options)`: Solves systems ($2 \times 2$ to $5 \times 5$) with step-by-step tracking and built-in educational presets (`standard_3x3`, `row_swap_2x2`, `near_singular_3x3`, `singular_3x3`).
  - `fitLinearAndQuadraticRegression(x, y, options)`: Evaluates simultaneous first-order linear ($y = a_0 + a_1 x$) and second-order quadratic ($y = a_0 + a_1 x + a_2 x^2$) models on the same data. Implements predictor centering ($x' = x - \bar{x}$) to decouple off-diagonal covariance in $3 \times 3$ normal equations, algebraic coordinate recovery ($a_2 = c_2, a_1 = c_1 - 2 c_2 \bar{x}, a_0 = c_0 - c_1 \bar{x} + c_2 \bar{x}^2$), and Residual Sum of Squares ($\text{RSS} = \sum (y_i - \hat{y}_i)^2$). Includes overfitting warning card.
  - `extractTransitionsForLab(acceptedDataset)`: Extracts anonymous $(s_t, s_{t+1})$ transitions from the active dataset for regression comparison without PII.
  - `runNewtonInterpolationExperiment(x, y, xEval)`: Constructs triangular divided-difference recurrence table, computes Newton polynomial coefficients $c_k = f[x_0, \dots, x_k]$, breaks down evaluation term-by-term ($c_k \prod (x - x_j)$), and flags extrapolation queries outside $[x_{\min}, x_{\max}]$.
  - `runRungeExperiment(nodeCount, distributionType, options)`: Simulates Runge's phenomenon on $f(x) = \frac{1}{1 + 25x^2}$ over $[-1, 1]$. Contrasts equally spaced vs. Chebyshev node distributions across $N = 5 \dots 13$. Evaluates Max Absolute Error and RMSE over a 101-point uniform grid.
  - `NUMERICAL_STABILITY_TOPICS`: Structured educational reference cards covering round-off vs. truncation, residual vs. solution error ($\|\mathbf{e}\| \le \|A^{-1}\| \|\mathbf{r}\|$), condition squaring $\kappa_2(X^T X) = (\kappa_2(X))^2$, and exact interpolation vs. least squares.
* **Interactive Presentation Layer (`js/ui/numerical_lab_view.js`)**:
  - 5 interactive sub-tabs: Gaussian Elimination Trace (`exp-a`), Linear vs. Quadratic Regression (`exp-b`), Newton Divided Differences (`exp-c`), Runge Phenomenon & Risk (`exp-d`), and Numerical Stability Topics (`topics`).
  - Step navigation controller for Gaussian elimination: First, Prev, Next, Last, with matrix table cell highlights (`.matrix-cell-pivot`, `.matrix-cell-eliminated`, `.matrix-row-swap`).
  - Comparative SVG vector plots for linear vs. quadratic regression and Runge oscillation curves, with dual-representation accessible table toggles.
* **Component Styling (`css/components.css`)**:
  - Added CSS classes for `.matrix-augmented-container`, `.matrix-table`, `.matrix-cell`, `.matrix-cell-pivot`, `.matrix-cell-eliminated`, `.matrix-cell-zero`, and `.matrix-row-swap`.
* **Application Routing & Brand Banner (`js/app.js`, `index.html`)**:
  - Wired `tabName === 'lab'` to mount `NumericalLabView`.
  - Updated brand tag to `v1.0 (Phase 9)` and status banner to Phase 9 Numerical Lab.
* **Automated Unit & Integration Test Suite (`tests/test_numerical_lab.js`)**:
  - 32 comprehensive tests (`TC-LAB-01` to `TC-LAB-32`) covering:
    1. Gaussian Elimination step-by-step traces (`TC-LAB-01` to `10`).
    2. Linear vs. Quadratic Regression & centering (`TC-LAB-11` to `18`).
    3. Newton Divided Differences & extrapolation (`TC-LAB-19` to `23`).
    4. Runge Phenomenon & error metrics (`TC-LAB-24` to `28`).
    5. State integration, stability topics & regression checks (`TC-LAB-29` to `32`).

### Executed & Verified
* Executed `npm test` (`node tests/test_runner.js`):
  - Total Suites: 37 (3 Foundation, 5 Dataset/CSV, 2 Linear Algebra, 2 Regression, 2 Interpolation, 4 Temporal Validation, 3 Prediction Workflows, 5 OCR & Key Reconciliation, 6 Dashboard & Analytics, 5 Numerical Lab)
  - Total Tests: 216
  - Passed: 216
  - Failed: 0
  - Execution Time: ~66ms

---

## [1.0.8] - October 2026 (Phase 8: Analytical Dashboard & Data Visualization)

### Added
* **Pure Mathematical Dashboard Analytics Engine (`js/core/dashboard_analytics.js`)**:
  - `calculateQuantile(sortedValues, p, convention)`: Implemented R Type 7 / Excel `PERCENTILE.INC` linear quantile interpolation ($h = (n - 1)p, Q(p) = x_{\lfloor h \rfloor} + (h - \lfloor h \rfloor)(x_{\lceil h \rceil} - x_{\lfloor h \rfloor})$).
  - `computeCohortOverview(dataset, temporalResults)`: Computes verified cohort summary metrics (unique students, accepted records, semester span, consecutive transitions, missing semester gaps, incomplete histories, regression status, temporal evaluation status). Strictly distinguishes fitted existence from demonstrated predictive superiority.
  - `computeSemesterDistribution(dataset, semesterNo, options)`: Computes 8-bin uniform histogram ($w = 0.50$, right-closed interval handling $[0.00, 4.00]$) and 5-point Tukey boxplot ($Q_1, \text{Median}, Q_3, \text{IQR}$, fences $[Q_1 - 1.5\text{IQR}, Q_3 + 1.5\text{IQR}]$, whiskers to most extreme data points within fences, and explicit outlier candidates). Rejects missing values without zero imputation and enforces $n \ge 4$ for boxplots.
  - `computeTransitionScatter(dataset, options)`: Extracts strictly consecutive transitions $(s_t, s_{t+1})$ from `buildTransitionPairs()`. Evaluates class-wide fitted regression line ($y = a + b\,x$) and optional persistence reference ($y = x$). Strictly prevents artificial transitions across missing semester gaps.
  - `computeResidualAnalysis(dataset, options)`: Evaluates in-sample training residuals $e_i = y_i - \hat{y}_i$ vs. fitted values $\hat{y}_i$. Verifies zero-mean property ($\sum e_i \approx 0$). Explicitly labels residuals as in-sample fit diagnostics, never out-of-sample temporal validation errors.
  - `computeDashboardTemporalEvaluation(evaluationResults)`: Summarizes Phase 5 expanding-window holdout metrics (paired MAE, paired RMSE, sample count $N_{\text{paired}}$, fold count, failed/skipped folds, and relative percentage error reduction $\Delta\%$). Distinguishes positive gains from regression underperformance.
  - `computeTransitionMatrix(dataset)`: Generates $K \times K$ transition availability matrix tabulating 1-step consecutive transition counts while strictly zeroing non-consecutive jumps (`Gap (0)` / `GAP_SKIPPED`).
  - `detectUnusualObservations(dataset, options)`: Deterministic $1.5 \times \text{IQR}$ review candidate detection across both semester SGPA distributions and in-sample residuals. Strict privacy preservation: outputs only pseudonymous keys, semester coordinates, values, and boundary context. Strictly forbids automatic deletion, alteration, or correction.
* **Interactive Presentation Layer (`js/ui/dashboard_view.js`)**:
  - 5 interactive sub-tabs: Transitions Scatter & Fit, Semester Distributions, Temporal Evaluation, Transition Matrix, and Review Candidates.
  - Pure SVG vector rendering with obsidian/crimson theme tokens, responsive viewBox scaling, crisp gridlines, dashed reference lines, and interactive mouse hover tooltips with client coordinate positioning.
  - Educational empty state when no dataset is accepted, providing direct call-to-action buttons for CSV ingestion and synthetic demo data loading.
  - Dual presentation mode: interactive SVG chart view and accessible, screen-reader-friendly semantic HTML tables with toggle controls.
* **Component Styling (`css/components.css`)**:
  - Added CSS rules for `.chart-card`, `.chart-header`, `.svg-chart-container`, `.chart-svg`, `.chart-tooltip`, `.chart-legend`, `.matrix-table`, `.matrix-cell-consecutive`, `.matrix-cell-gap`, `.pill-group`, `.pill-btn`.
* **State Integration & Route Mounting (`js/app.js`, `index.html`)**:
  - Registered `DashboardView` as default mounted tab in `App.init()`.
  - Added tab switching between `#tab-dashboard`, `#tab-dataset`, `#tab-ocr`, and `#tab-predict`.
  - Subscribed dashboard view to `stateManager.subscribe('acceptedDataset')` for instant atomic re-rendering on dataset replacement or discard.
* **Automated Unit & Integration Test Suite (`tests/test_dashboard.js`)**:
  - 33 rigorous test cases (`TC-DASH-01` to `TC-DASH-33`) verifying:
    1. Dataset Overview & Metrics (`TC-DASH-01` to `06`).
    2. Distribution Charts & Quantile Mechanics (`TC-DASH-07` to `11`).
    3. Transition Scatter & In-Sample Residuals (`TC-DASH-12` to `17`).
    4. Temporal Evaluation & Baseline Comparisons (`TC-DASH-18` to `22`).
    5. Transition Matrix & Unusual Observation Detection (`TC-DASH-23` to `27`).
    6. State Reactivity, Import/Discard Lifecycle, & Privacy Isolation (`TC-DASH-28` to `33`).

### Executed & Verified
* Executed `npm test` (`node tests/test_runner.js`):
  - Total Suites: 32 (3 Foundation, 5 Dataset/CSV, 2 Linear Algebra, 2 Regression, 2 Interpolation, 4 Temporal Validation, 3 Prediction Workflows, 5 OCR & Key Reconciliation, 6 Dashboard & Analytics)
  - Total Tests: 184
  - Passed: 184
  - Failed: 0
  - Execution Time: ~56ms

---

## [1.0.7] - October 2026 (Phase 7: Privacy-Preserving OCR Ingestion & Key Reconciliation)

### Added
* **Pure Mathematical OCR Candidate & Key Reconciliation Engine (`js/core/ocr_engine.js`)**:
  - `validateDocumentFile(file, options)`: Validates file type (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`), MIME types, file size ($\le 15\text{MB}$), and dimension constraints ($\le 8000\text{px}$).
  - `transformCropCoordinates(displayCrop, displayDim, naturalDim, rotation)`: Maps display-scaled crop rectangles $(x, y, w, h)$ to natural image pixels, handling arbitrary aspect ratios and 0°, 90°, 180°, and 270° rotations.
  - `extractSgpaCandidatesFromText(ocrText, options)`: Parses line-by-line OCR output into candidate records. Identifies valid floats, detects decimal ambiguities (e.g. `376` $\to$ proposed `3.76` flagged for human review), flags out-of-scale values, detects multiple numbers on single lines, flags unreadable rows, and checks OCR confidence threshold ($< 60\%$). Never silently replaces unreadable values with zero.
  - `reconcileStudentKeys(candidates, existingKeys, explicitMappings)`: Maps extracted rows to existing pseudonymous student keys or creates unique collision-checked keys. Strictly refuses to infer identity from row position. Detects duplicate `(student_key, semester_no)` collisions.
  - `buildCandidateImportDataset(reconciledRows, acceptedDataset)`: Assembles prospective combined dataset and executes strict schema validation.
* **Browser-Side OCR Service & In-Memory Controller (`js/services/ocr_service.js`)**:
  - Ephemeral document management: decodes images via `FileReader` and PDFs via PDF.js (`pdfjsLib.getDocument`).
  - Page selection and rendering: renders selected PDF pages to an off-screen HTML5 canvas.
  - Interactive crop sub-canvas extraction: creates a dedicated sub-canvas containing *strictly* the user's cropped SGPA column, discarding all student names, roll numbers, and headers before OCR.
  - Web Worker OCR execution: controls Tesseract.js Web Worker (`Tesseract.createWorker`) in digit-oriented recognition mode (`tessedit_char_whitelist: '0123456789.'`).
  - Staging isolation & review invalidation: changing page, rotation, or crop immediately invalidates prior reviews.
  - Ephemeral memory purge: `discardTemporaryState()` wipes all canvas references, decoded document bytes, and OCR candidate buffers from memory.
* **Atomic Dataset Commitment (`js/services/state_manager.js`)**:
  - Implemented `commitReconciledRecords(reconciledRows)`: combines proposed rows with `state.acceptedDataset`, validates against `validateAndNormalizeDataset(combined)`, and atomically replaces the accepted dataset only if 100% valid.
  - On validation error or conflict, preserves the previously accepted dataset completely unchanged with zero partial mutations.
* **OCR Presentation Layer (`js/ui/ocr_view.js`)**:
  - Full 5-stage interactive workflow: Upload $\to$ Page Selection & Column Crop $\to$ Recognizing $\to$ Human Review & Key Reconciliation $\to$ Atomic Commitment.
  - Interactive crop interface: draggable, resizable canvas overlay with 90° rotation controls and visual boundary guides.
  - Human review grid: editable candidate SGPA values, confidence percentage badges, status callouts, proposed decimal fix alerts, dynamic row addition/deletion, and pseudonymous key mapping dropdowns.
  - Synthetic demo marksheet loader: allows testing the full pipeline instantly without external files.
* **Component Styling (`css/components.css`)**:
  - Added CSS classes for OCR dropzones, document canvas containers, draggable crop rectangles, progress bars, review tables, and key reconciliation selectors.
* **Vendor Asset Integration (`index.html`)**:
  - Pinned PDF.js v3.11.174 and Tesseract.js v5 CDN assets with worker source configuration.
  - Updated application title and brand banner to Phase 7.
* **Automated Headless Test Suite (`tests/test_ocr.js`)**:
  - 36 comprehensive automated test cases covering: document handling, coordinate transformations, candidate extraction, ambiguity handling, decimal fixes, key reconciliation, review invalidation, rollback on error, atomic commitment, ephemeral memory disposal, zero document exfiltration (`TC-OCR-31`), zero crop/text exfiltration (`TC-OCR-32`), zero storage persistence (`TC-OCR-33`), strict schema minimization (`TC-OCR-34`), and diagnostic PII exclusion (`TC-OCR-35`).

### Executed & Verified
* Executed `npm test` (`node tests/test_runner.js`):
  - Total Suites: 26 (3 Foundation, 5 Dataset/CSV, 2 Linear Algebra, 2 Regression, 2 Interpolation, 4 Temporal Validation, 3 Prediction Workflows, 5 OCR & Key Reconciliation)
  - Total Tests: 151
  - Passed: 151
  - Failed: 0
  - Execution Time: ~50ms

---

## [1.0.6] - October 2026 (Phase 6: Prediction Workflows)

### Added
* **Model C: Individual Least-Squares Trend (`js/core/regression_engine.js`)**:
  - Implemented `fitIndividualTrend(observations, options)` for single-student trajectories ($s_k = a + b\,k + \epsilon_k$).
  - Validates positive integer semester numbers ($1 \le k \le 12$), finite SGPA within scale ($[0.00, 4.00]$), strictly rejects duplicate semester numbers, and chronologically sorts observations before fitting.
  - Solves Centered Normal Equations via Gaussian elimination with decoupled coordinates and scale-aware pivoting.
  - Predicts for target semester $k_{\text{target}} = k_{\text{latest}} + 1$ without requiring cohort transitions.
  - Implements degrees of freedom policy ($\nu = K - 2$) with two-tailed critical $t$-values ($K=3: 12.71, K=4: 4.30, K=5: 3.18$) and volatility warning flags.
  - Preserves raw mathematical predictions unclipped when out of range ($< 0.00$ or $> 4.00$) with explicit warnings.
* **Core Prediction Service (`js/core/prediction_service.js`)**:
  - `predictIndividualStudent(observations, modelType, options)`: Evaluates Model C, Model B (Shared Class-Wide Regression), or Model A (Persistence Baseline) with comprehensive validation and metadata.
  - `predictWholeClass(dataset, options)`: Generates next-semester forecasts for all students in an accepted cohort dataset; builds valid consecutive transitions; fits shared linear regression; computes Phase 5 holdout validation comparison metrics; assigns explicit prediction statuses (`PREDICTED`, `OUT_OF_RANGE`, `INSUFFICIENT_HISTORY`, `MODEL_UNAVAILABLE`).
  - `exportWholeClassCSV(studentPredictions)`: Exports RFC-4180 compliant CSV strictly containing pseudonymous identifiers and prediction columns (`student_key`, `latest_semester`, `latest_sgpa`, `target_semester`, `predicted_sgpa`, `baseline_prediction`, `model_name`, `prediction_status`, `out_of_range`). Strictly omits all personal identifiers (names, emails, rolls). Exports missing predictions as empty fields, never as zero.
  - `exportIndividualCSV(individualResult)`: Formats client-side RFC-4180 CSV containing individual prediction metadata, model specification, and input observations.
* **Prediction Workflows Presentation Layer (`js/ui/prediction_view.js`)**:
  - Interactive UI mounted via `js/app.js` on the `predictions` tab.
  - Model Status & Temporal Validation Context panel displaying shared model formula, training transition counts, and paired holdout MAE/RMSE comparisons (Regression vs. Persistence) with warnings when regression fails to beat baseline.
  - Sub-tab navigation between Individual Student Trajectory and Whole-Class Cohort Prediction.
  - Individual Prediction Form: dynamic 3–7 observation row inputs, row addition/removal, pre-fill sample button, model selector, hero prediction result card, and CSV download.
  - Whole-Class Cohort Prediction Table: summary KPI cards, status filter buttons, search input, sortable column headers, side-by-side baseline comparisons, and batch CSV export.
* **Component Styling (`css/components.css`)**:
  - Added CSS classes for sub-tab navigation, observation row grids, hero prediction cards, filter button groups, sortable table headers, and status callouts.
* **Automated Headless Test Suite (`tests/test_prediction.js`)**:
  - 26 comprehensive automated test cases verifying individual prediction constraints, degrees of freedom, unordered sorting, duplicate rejection, shared model availability gating, whole-class multi-student independence, non-bridging of semester gaps, RFC-4180 CSV format compliance, PII exclusion, and missing value fidelity.

### Executed & Verified
* Executed `npm test` (`node tests/test_runner.js`):
  - Total Suites: 21 (3 Foundation, 5 Dataset/CSV, 2 Linear Algebra, 2 Regression, 2 Interpolation, 4 Temporal Validation, 3 Prediction Workflows)
  - Total Tests: 115
  - Passed: 115
  - Failed: 0
  - Execution Time: 24ms

---

## [1.0.5] - October 2026 (Phase 5: Temporal Validation & Model Evaluation)

### Added
* **Rolling-Origin Temporal Evaluation Engine (`js/core/temporal_validator.js`)**:
  - Pure mathematical validation engine implementing expanding-window chronological cross-validation.
  - Strict temporal isolation rule: $\max(\text{training target semester}) < t$. Transitions targeting semester $t$ or later are strictly prohibited from entering training.
  - Independent, testable metric functions: `computeMae(actual, predicted)` and `computeRmse(actual, predicted)` with validation against empty arrays, length disparities, and non-finite numbers (`NaN`, `Infinity`).
  - Expanding-window model training: fits Class-Wide Linear Regression strictly using earlier valid transitions.
  - Baseline evaluation: computes Persistence Baseline ($\hat{s}_t = s_{t-1}$) across all eligible test observations, continuing even when regression fitting fails or is skipped.
  - Explicit fold status taxonomy: `EVALUATED`, `INSUFFICIENT_TRAINING_DATA`, `FIT_FAILED`, and `SKIPPED_NO_TEST_DATA`. Zero silent substitutions.
  - Prediction-level record generation: records pseudonymous `student_key`, source/target semesters, actual SGPA, persistence prediction, regression prediction, absolute errors, out-of-range flag, and fold status without leaking PII.
  - Observation-weighted pooled summaries: computes pooled MAE and RMSE directly from pooled individual prediction records rather than unweighted fold averages.
  - Fair comparison guarantee: computes primary comparative metrics ($\text{MAE}$, $\text{RMSE}$, $\Delta_{\text{MAE}}$, $\Delta_{\text{RMSE}}$) strictly over paired test records where both models forecasted.
  - Out-of-range preservation: raw mathematical regression predictions exceeding $[0.00, 4.00]$ are never silently clipped.
  - Deep cloning guarantees caller input immutability.
* **Automated Headless Test Suite (`tests/test_validation.js`)**:
  - 24 comprehensive test cases covering: known-sample MAE/RMSE, zero error on perfect fit, empty/mismatched/non-finite array rejection, strict chronological training boundary, zero test-in-train overlap, monotonic window expansion, missing gap skipping, multi-student isolation, explicit status on insufficient datasets, identical paired targets, persistence equality, prior-window coefficient matching, explicit fit failure logging, baseline survival, raw out-of-range preservation, non-finite protection, future-alteration invariance (anti-leakage proof), strict future transition exclusion, pooled vs unweighted aggregation, and input immutability.

### Executed & Verified
* Executed `npm test` (`node tests/test_runner.js`):
  - Total Suites: 18 (3 Foundation, 5 Dataset/CSV, 2 Linear Algebra, 2 Regression, 2 Interpolation, 4 Temporal Validation)
  - Total Tests: 89
  - Passed: 89
  - Failed: 0
  - Execution Time: 20ms

---

## [1.0.4] - October 2026 (Phase 4: Numerical Engine Implementation)

### Added
* **Linear System Solver with Scale-Aware Pivoting (`js/core/linear_algebra.js`)**:
  - Generic solver $A\mathbf{x} = \mathbf{b}$ using Gaussian elimination with row partial pivoting and back substitution.
  - Scale-aware relative pivot threshold $|M_{p,k}| < \tau_{\text{rel}} \cdot \|A\|_{\max}$ ($\tau_{\text{rel}} = 10^{-14}$ default).
  - Explicit all-zero matrix detection and dimension mismatch validation.
  - Non-finite check preventing `NaN` and `Infinity` propagation.
  - Input immutability guarantee: deep matrix/vector cloning prevents mutation of caller arguments.
  - Custom error classes: `SingularMatrixError`, `DimensionMismatchError`, `NonFiniteValueError`.
  - Theoretical complexity: $O(n^3)$ forward elimination, $O(n^2)$ back substitution.
* **Consecutive Transition Construction & Regression Engine (`js/core/regression_engine.js`)**:
  - `buildConsecutiveTransitions(records)`: Builds valid one-step transitions ($s_t \to s_{t+1}$); strictly skips missing semester gaps without bridging or fabricating records; rejects duplicate `(student_key, semester_no)` pairs; sorts deterministically by `student_key` ASC and `from_semester` ASC.
  - `predictPersistence(previousSgpa, config)`: Implements the baseline $\hat{s}_{t+1} = s_t$; validates against configured SGPA scale; strictly preserves raw unclipped values.
  - `fitLinearRegression(x, y, config)`: Implements least-squares fit $y = a + bx + \epsilon$; enforces predictor variance pre-check ($\text{Var}(x) \ge 10^{-12}$); applies predictor centering ($x' = x - \bar{x}$) to decouple off-diagonal covariance before solving Normal Equations via Gaussian elimination; converts coefficients back to original coordinates ($a = \bar{y} - b\bar{x}$); calculates in-sample residuals, $R^2$, MAE, RMSE; provides raw predict function with out-of-scale flagging.
  - `fitTransitionRegression(transitions, config)`: End-to-end integration mapping consecutive transition records to trained linear model with metadata.
* **Newton Divided-Difference Interpolation Subsystem (`js/core/interpolation_engine.js`)**:
  - Educational laboratory module computing divided differences $f[x_0, \dots, x_k]$.
  - Exact polynomial evaluation $P_n(x)$ via Newton form.
  - Guaranteed exact point reproduction ($\max |P_n(x_i) - y_i| < 10^{-12}$).
  - Rejection of duplicate $x$ nodes ($|x_j - x_i| < 10^{-14}$) preventing division by zero.
  - Explicit domain tagging distinguishing interpolation ($x \in [\min, \max]$) from extrapolation.
* **Automated Headless Test Suites**:
  - `tests/test_linear_algebra.js` (10 tests): Solvers, row swapping, singular rejection, near-singular scale tolerance, all-zero matrix, non-finite checks, scale invariance, immutability.
  - `tests/test_regression.js` (12 tests): Transition construction, multi-student isolation, gap skipping, duplicate rejection, deterministic sort, persistence baseline, exact line fit, centering recovery, noisy fit, variance pre-check, sample minimum, raw output preservation.
  - `tests/test_interpolation.js` (8 tests): Table computation, point reproduction, interior evaluation, extrapolation tagging, duplicate node rejection, dimension checks, non-finite node checks, immutability.

### Executed & Verified
* Executed `npm test` (`node tests/test_runner.js`):
  - Total Suites: 14 (3 Foundation, 5 Dataset/CSV, 2 Linear Algebra, 2 Regression, 2 Interpolation)
  - Total Tests: 65
  - Passed: 65
  - Failed: 0
  - Execution Time: 17ms

---

## [1.0.3] - October 2026 (Phase 3: Dataset Management Layer & CSV Validation)

### Added
* **RFC-4180 CSV Parsing & Schema Validation Engine (`js/core/data_validator.js`)**:
  - Pure mathematical and string parsing module completely decoupled from DOM APIs.
  - RFC-4180 compliance: handles quoted fields, escaped double quotes (`""`), embedded commas, and embedded newlines.
  - Whitelist schema enforcement: requires exactly `student_key,semester_no,sgpa`; strictly rejects unexpected columns (such as `name`, `roll_no`, `email`) to protect student privacy.
  - Field-level validation: trimmed pseudonymous keys (regex `^[A-Za-z0-9_-]{1,32}$`), positive integer semesters ($1 \le \text{sem} \le 12$), finite float SGPAs within configurable scale ($[0.00, 4.00]$).
  - Explicit decimal comma rejection with helpful error guidance.
  - Duplicate detection: flags duplicate `(student_key, semester_no)` records without leaking raw marks.
  - Missing semester gap tracking: identifies non-consecutive semesters and strictly preserves actual semester indices without bridging.
  - Deterministic normalization: records sorted by `student_key` ASC and `semester_no` ASC.
  - Summary statistics computation: student counts, record totals, observed semester span, history horizon distribution, and gap lists.
* **In-Memory Session State Manager (`js/services/state_manager.js`)**:
  - Implements staging buffer workflow (`stagedDataset` vs `acceptedDataset`).
  - Staging protection: failed imports update `stagedErrors` without corrupting or overwriting an already accepted dataset.
  - Memory discard & purge: `clearAcceptedDataset()` completely wipes all active and staged records from browser heap.
  - Reactive state subscription mechanism for UI components.
* **Dataset Management UI Component (`js/ui/dataset_view.js` & `css/components.css`)**:
  - Styled dropzone supporting file selection and drag-and-drop.
  - One-click "Load Synthetic Sample" button for testing with synthetic demo records.
  - Schema guidance box detailing the required 3-column format and privacy requirements.
  - Actionable error alert cards citing exact line numbers without exposing personal data.
  - Staged confirmation card displaying summary KPIs, missing gap warnings, first 10 normalized records, and an explicit `Confirm & Accept Dataset` button.
  - Active cohort dataset card displaying accepted KPIs, record table, and `Discard Dataset from Memory` button.
  - Clean empty state when no dataset is loaded.
* **Automated Headless Test Suite (`tests/test_csv_parser.js`)**:
  - 20 verification test cases covering: standard parsing, quotes and escaping, empty and whitespace files, header-only CSV, missing columns, unexpected PII headers, empty keys, invalid semester numbers, malformed SGPAs and commas, out-of-scale values, non-finite tokens, duplicates, variable horizons (3 to 7 semesters), missing gaps, multiple students, deterministic sorting, stable key persistence, staging overwrite protection, memory purge, and error diagnostic anonymity.

### Executed & Verified
* Executed `npm test` (`node tests/test_runner.js`) via Node.js LTS:
  - Total Suites: 8
  - Total Tests: 30 (10 foundation + 20 dataset)
  - Passed: 30
  - Failed: 0
  - Execution Time: 12ms

---

## [1.0.2] - October 2026 (Phase 2 Foundation & Test Harness)

### Added
* Minimal package.json configuration for ES modules.
* Obsidian & Crimson design tokens in `css/main.css`.
* Clean HTML5 entry point `index.html`.
* Application bootstrap in `js/app.js`.
* Pure mathematical utilities in `js/core/math_utils.js`.
* Headless test runner in `tests/test_runner.js` with 10 passing tests in `tests/test_foundation.js`.

---

## [1.0.1] - October 2026 (Phase 1 Mandatory Corrections)

### Corrected & Enhanced
* Replaced fixed determinant threshold with multi-stage conditioning strategy.
* Mandated raw mathematical prediction display without silent clipping.
* Formally defined stable pseudonymous keys and cross-semester key reconciliation.
* Clarified asset downloads vs zero outbound data transmission.
* Clarified local server requirements for native ES6 modules.
* Grounded small-history warnings in residual degrees of freedom ($\nu = K - 2$).
* Formally labeled sample data as synthetic.

---

## [1.0.0-phase1] - October 2026

### Added
* Initial comprehensive project documentation baseline (24 documents and sample template).
