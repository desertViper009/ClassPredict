# Requirements Specification — ClassPredict

> **Document ID**: DOC-REQ-001  
> **Status**: Approved (Phase 1 Baseline with Mandatory Corrections)  
> **Lifecycle State**: Designed  
> **Last Updated**: October 2026

---

## 1. Requirement Conventions & Classification

Requirements are codified with standardized keys:
* **FR-xx**: Functional Requirement
* **NFR-xx**: Non-Functional Requirement

Each requirement includes:
* **Priority**: P1 (Critical / Core), P2 (High / Secondary), P3 (Educational / Polish)
* **Status**: `Planned` | `Designed` | `Implemented` | `Tested` | `Verified` | `Deployed`
* **Dependencies**: Prerequisites for implementation
* **Acceptance Criteria**: Verifiable conditions of satisfaction

---

## 2. Functional Requirements

### FR-01: Dashboard & Academic Performance Overview
* **Priority**: P1
* **Status**: `Designed`
* **Dependencies**: FR-02
* **Description**: Provide a comprehensive visual overview of the loaded dataset, historical semester distributions, cohort metrics, and active model status.
* **Acceptance Criteria**:
  1. Displays total student count ($N$), total semester records, and semester range (e.g., Semesters 1 to 5).
  2. Renders historical SGPA distribution histograms and per-semester average/median trends.
  3. Displays active model evaluation metrics (MAE, RMSE against persistence baseline) *only* when evaluated on valid historical targets.
  4. Clearly and prominently indicates whether the displayed data is an imported user dataset or synthetic demonstration data.
  5. Never fabricates model accuracy or displays synthetic metrics as verified empirical findings.

### FR-02: Dataset Management & Long-Format Schema Validation
* **Priority**: P1
* **Status**: `Designed`
* **Dependencies**: None
* **Description**: Parse, clean, validate, and manage cohort datasets from manual uploads or verified OCR imports.
* **Acceptance Criteria**:
  1. Ingests long-format CSV files adhering strictly to the schema: `student_key`, `semester_no`, `sgpa`.
  2. Rejects files missing mandatory columns or containing unparsed headers.
  3. Enforces consistent pseudonymous student keys across semesters; duplicate `(student_key, semester_no)` entries halt parsing with line numbers.
  4. Validates numeric boundaries: `semester_no` must be positive integer $\ge 1$; `sgpa` must be a valid float in configured scale (default $[0.00, 4.00]$).
  5. Identifies gap semesters (e.g., Semesters 1 and 3 present, Semester 2 missing) and enforces non-bridging rules for transition modeling.
  6. Allows export of the cleaned, validated dataset to CSV.
  7. Retains data solely in client volatile memory (no persistent backend transmission).

### FR-03: Individual Student SGPA Prediction & Degree-of-Freedom Warnings
* **Priority**: P1
* **Status**: `Implemented & Tested (Phase 6)`
* **Dependencies**: FR-02, FR-07
* **Description**: Predict the next-semester SGPA for an individual student based on their unique completed semester history (variable length: 3–7 semesters).
* **Acceptance Criteria**:
  1. Accepts manual input of 3 to 7 consecutive or gapped semester SGPA values without requiring a whole-class dataset upload.
  2. Allows selection of candidate prediction models:
     - Model C (Individual Least-Squares Trend, fitting $s_k = a + b\,k$).
     - Model B (Class-Wide Transition Model, if an eligible class dataset is loaded and fitted).
     - Model A (Persistence Baseline Fallback: $\hat{s}_{t+1} = s_t$).
  3. Displays statistical uncertainty warnings grounded in residual degrees of freedom ($\nu = K - 2$): extreme volatility warning for $K=3$ ($\nu=1, t_{\text{crit}}=12.71$), high volatility warning for $K=4$ ($\nu=2, t_{\text{crit}}=4.30$).
  4. Explicitly displays active model name, mathematical formula, observation count, and training transition count.
  5. **Out-of-Range Policy**: Always displays the exact raw mathematical prediction as primary output. Never silently clips predictions. Displays an explicit amber warning badge whenever raw $\hat{s} \notin [0.00, 4.00]$.
  6. Supports client-side CSV export of individual predictions and historical observations without transmitting personal identifiers.

### FR-04: Whole-Class Cohort Prediction
* **Priority**: P1
* **Status**: `Implemented & Tested (Phase 6)`
* **Dependencies**: FR-01, FR-02, FR-08
* **Description**: Batch calculate next-semester SGPA estimates for all eligible students within the loaded cohort dataset.
* **Acceptance Criteria**:
  1. Identifies each unique student's latest completed semester $t$ and latest recorded SGPA $s_t$.
  2. Calculates predicted SGPA $\hat{s}_{t+1}$ using the fitted class transition model.
  3. Displays an interactive tabular report containing: `Student Key`, `Latest Semester`, `Latest SGPA`, `Raw Predicted SGPA`, `Out-of-Bounds Flag`, and `Model Status`.
  4. Flags students with insufficient data (history $< 2$ consecutive semesters) as `Insufficient History` without inventing synthetic numbers.
  5. Supports multi-column sorting (by student key, latest SGPA, predicted SGPA), filtering by semester horizon, and export to CSV.

### FR-05: Privacy-Preserving OCR Ingestion & Key Reconciliation
* **Priority**: P2
* **Status**: `Designed`
* **Dependencies**: FR-02
* **Description**: Enable optical character recognition extraction of SGPA records from scanned university result sheets (PDF/image) with user-controlled cropping, Web Worker execution, and a mandatory human verification barrier.
* **Acceptance Criteria**:
  1. Accepts image files (`.png`, `.jpg`, `.jpeg`) and document files (`.pdf`).
  2. For multi-page PDFs, provides a page selector to pick the target result sheet, rendered locally via PDF.js.
  3. Provides an interactive canvas-based rectangular crop tool, requiring the user to isolate *only* the SGPA column and discard all student names and registration numbers before OCR execution.
  4. Executes client-side OCR (via Tesseract.js Web Worker) specifically on the cropped sub-image; distinguishes downloading application assets from transmitting user academic records.
  5. Parses recognized floating-point numbers into an editable review table displaying `Extracted Value`, `Confidence Score (%)`, and `Assigned Student Key`.
  6. **Key Reconciliation**: Enforces that student identity is NEVER inferred solely from OCR row order. For multi-semester ingestion, requires user to explicitly map candidate rows to existing stable pseudonymous keys.
  7. Strict gating: No OCR candidate is committed to the application dataset until the user explicitly reviews, reconciles keys, and clicks `Confirm and Import`.
  8. Enforces scale validation ($0.00 \le \text{SGPA} \le 4.00$) during review, highlighting out-of-range cells in red.

### FR-06: Manual CSV Import & Privacy Schema Enforcement
* **Priority**: P1
* **Status**: `Designed`
* **Dependencies**: FR-02
* **Description**: Provide a standardized manual CSV ingestion workflow that strictly excludes personally identifiable information.
* **Acceptance Criteria**:
  1. Accepts UTF-8 CSV files with header: `student_key,semester_no,sgpa`.
  2. Automatically strips or rejects non-whitelisted columns (such as names or phone numbers) prior to tabular ingestion.
  3. Provides a downloadable sample CSV template clearly labeled as synthetic demonstration data.
  4. Displays a clear validation summary dialog showing: total rows processed, valid rows accepted, and specific line-by-line syntax errors.

### FR-07: Numerical Methods Laboratory
* **Priority**: P1
* **Status**: `Designed`
* **Dependencies**: None
* **Description**: Provide an interactive educational workspace demonstrating core numerical algorithms, scale-aware conditioning, and error dynamics.
* **Acceptance Criteria**:
  1. Implements Linear Least-Squares Regression ($y = a + b\,x$) with predictor centering to minimize matrix conditioning.
  2. Implements Polynomial Least-Squares Curve Fitting (Degree 2 Parabola: $y = a + b\,x + c\,x^2$) solved via a $3 \times 3$ linear system using Gaussian Elimination with row partial pivoting and scale-aware relative pivot tolerance ($\tau_{\text{rel}} = 10^{-14}$).
  3. Implements Newton Divided-Difference Polynomial Interpolation, computing the divided difference table and interpolating polynomial $P_n(x)$.
  4. Features an interactive comparison tool demonstrating why polynomial interpolation is suited for interior interpolation ($x \in [x_0, x_n]$) but wildly unstable for forward extrapolation ($x > x_n$).
  5. Replaces fixed determinant rules with a multi-stage conditioning strategy: input variance check ($\text{Var}(x) < 10^{-12}$), predictor centering, scale-aware pivoting, and non-finite checks.

### FR-08: Model Evaluation & Reporting Engine
* **Priority**: P1
* **Status**: `Designed`
* **Dependencies**: FR-02, FR-07
* **Description**: Provide temporally valid model evaluation comparing candidate transition models against the persistence baseline.
* **Acceptance Criteria**:
  1. Implements rolling-origin (expanding-window) temporal cross-validation: fits models strictly on past semesters ($k < T$) and evaluates predictions on semester $T$.
  2. Strictly prohibits random row-shuffling or k-fold CV that leaks future semester information into past training sets.
  3. Calculates Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE).
  4. Computes persistence baseline ($\hat{s}_{t+1} = s_t$) metrics over identical test transitions.
  5. Computes Relative Improvement: $\Delta_{\text{MAE}} = \frac{\text{MAE}_{\text{baseline}} - \text{MAE}_{\text{model}}}{\text{MAE}_{\text{baseline}}} \times 100\%$.
  6. Prohibits presenting coefficient of determination ($R^2$) as a percentage accuracy.
  7. Explicitly warns users when validation test count $M < 30$ that findings lack statistical power.

---

## 3. Non-Functional Requirements (NFR)

### NFR-01: Numerical Stability & Accuracy
* **Status**: `Designed`
* Solvers must employ row partial pivoting and scale-aware relative pivot threshold ($10^{-14} \cdot s_{\text{scale}}$) to prevent division by near-zero pivots.
* Check input variance $\text{Var}(x) < 10^{-12}$ and guard against non-finite arithmetic (`NaN`, `±Infinity`).
* Floating-point calculations must maintain double-precision (IEEE 754 64-bit float).

### NFR-02: Privacy & Data Minimization
* **Status**: `Designed`
* Distinguish asset downloads (e.g., Tesseract worker scripts or language models) from user academic records. Zero student records, marks, or raw images are transmitted to external servers.
* Session ephemerality: Uploaded marks and OCR canvases reside solely in volatile browser RAM and are purged upon tab close or reload.
* Anonymized identifiers: Datasets must strictly employ stable pseudonymous keys (e.g., `STU_001`).

### NFR-03: Performance & Responsiveness
* **Status**: `Designed`
* CSV parsing and validation for an 80-student, 7-semester dataset ($\approx 560$ rows) must complete in under 50 milliseconds.
* Numerical linear system solution ($2 \times 2$ and $3 \times 3$) must execute in under 5 milliseconds.
* Client-side OCR processing of a cropped column must complete within 5 seconds on standard desktop hardware.

### NFR-04: User Experience & Portfolio Aesthetics
* **Status**: `Designed`
* Modern dark aesthetic: Obsidian black surfaces (`#0B0B0E`), deep crimson accents (`#DC2626`), high-contrast typography (`#F8FAFC`), and clean card borders.
* Responsive layouts: Fully operational on desktop screens ($1920\times1080$, $1440\times900$) and laptops ($1280\times800$).
* No layout shifts, unstyled flash of content, or unhandled exceptions.

### NFR-05: Maintainability & Testability
* **Status**: `Designed`
* Pure, modular ES6 code architecture with decoupled business logic (numerical engine has zero UI DOM dependencies).
* 100% testable mathematical functions with deterministic unit tests for matrix operations, regression formulas, and validation splits.
