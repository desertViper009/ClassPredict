# User & Evaluator Guide — Gradivue

> **Document ID**: DOC-USER-001  
> **Status**: Approved & Verified (Phase 10 Production Deployment & Hardening Complete)  
> **Lifecycle State**: Deployed & Verified (Production Release, Service Worker, Educational Lab, Dashboard, OCR, Predictions & Dataset Active)  
> **Last Updated**: October 2026

---

## 1. Runtime Environment & Local Launch

Gradivue is a client-side web application built with vanilla JavaScript (ES6 Modules) and Vanilla CSS3.

### 1.1 Requirements to Run the Application:
* **Runtime**: Any standard modern web browser (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari).
* **Local HTTP Server**: Because the application uses native ES6 JavaScript modules (`import`/`export`), opening `index.html` directly via the `file://` protocol triggers browser Cross-Origin (CORS) security restrictions. A local HTTP server is required:
  ```bash
  # Option A: Using Python 3 built-in server (Recommended)
  cd /path/to/ClassPredict
  python -m http.server 8000

  # Option B: Using Node npx serve
  npx serve . -l 8000
  ```
  Then navigate to `http://localhost:8000`.

### 1.2 Requirements for Development & Testing:
* **Node.js LTS (v18+)**: Required **only** for executing the automated headless unit test suite (`tests/`):
  ```bash
  npm test
  # Or directly:
  node tests/test_runner.js
  ```

---

## 2. Preparing Academic Data for Ingestion

### 2.1 Long-Format CSV Requirements
To link multi-semester student records safely without exposing personal identities, your CSV must adhere strictly to the 3-column long-format schema:

```csv
student_key,semester_no,sgpa
SYN_001,1,3.45
SYN_001,2,3.52
SYN_001,3,3.60
SYN_002,1,2.80
SYN_002,2,2.95
```

* **`student_key`**: A consistent pseudonymous key (e.g., `STU_001`, `SYN_002`). A student must have the exact same key across semesters. Never include real names, roll numbers, or contact information (unexpected columns are automatically rejected).
* **`semester_no`**: Positive integer ($1, 2, 3, \dots, 12$).
* **`sgpa`**: Floating point number between $0.00$ and $4.00$ using standard dot notation (e.g., `3.65`). Decimal commas are not supported and will be rejected.

A pre-formatted template labeled with synthetic records is available at [`samples/sample_class_sgpa.csv`](../samples/sample_class_sgpa.csv).

---

## 3. Workflow 1: Dataset Ingestion & Management UI (Phase 3 Active)

The Phase 3 Dataset Management interface provides end-to-end dataset validation and in-memory session protection:

```
+-----------------------------------------------------------------------------------+
|  Dataset Management & Ingestion Layer                                             |
|  [Schema Guidance: student_key,semester_no,sgpa]       [Load Synthetic Sample]    |
+-----------------------------------------------------------------------------------+
|  [ File Dropzone: Drag & drop .csv or Browse ]                                   |
+-----------------------------------------------------------------------------------+
|  [ Error Diagnostics / Staged Preview Table & KPIs ]                              |
|  [ Confirm & Accept Dataset ]     [ Discard Staged ]                              |
+-----------------------------------------------------------------------------------+
|  [ Active Cohort Dataset Overview & KPIs ]             [ Discard Dataset Memory ] |
+-----------------------------------------------------------------------------------+
```

### Step-by-Step Instructions:
1. **Upload or Drag & Drop**:
   - Drag and drop a `.csv` file onto the dropzone, or click **Browse Files**.
   - Alternatively, click **Load Synthetic Sample** to instantly test the system with 10 synthetic students spanning variable horizons (3 to 7 semesters).
2. **Review Validation Feedback**:
   - **If Validation Fails**: A red alert card lists actionable errors with exact line numbers (e.g., duplicate semester entries, out-of-scale grades, unexpected PII columns).
   - **Privacy Protection in Errors**: Errors state line numbers and issues without logging raw student records.
   - **Backup Protection**: If you previously accepted a valid dataset, an invalid upload will **never** overwrite or erase your active data.
3. **Inspect the Staged Dataset**:
   - Summary KPI cards show total students ($N$), total records ($M$), observed semester range, and history horizon distribution.
   - Any student with missing semester gaps (e.g., Semesters 1 and 3 present without Semester 2) is prominently flagged with an alert.
   - Review the first 10 normalized records in the staged preview table.
4. **Explicit Acceptance Gate**:
   - Click **Confirm & Accept Dataset into Memory** to commit the records into active session memory.
   - Or click **Discard Staged File** to abort.
5. **Managing Active Memory**:
   - Once accepted, the dataset is marked with an active status badge.
   - Click **Discard Dataset from Memory** at any time to completely wipe all student records from browser RAM.

---

## 4. Workflow 2: Temporal Validation & Model Evaluation (Phase 5 Active)

The Phase 5 evaluation engine evaluates candidate prediction models using **Rolling-Origin Temporal Cross-Validation** without data leakage.

### 4.1 How Rolling-Origin Evaluation Works:
Unlike standard machine learning pipelines that use random train/test splits, ClassPredict enforces strict chronological ordering:
1. **Expanding Training Window**: When evaluating predictions for target semester $t$, the linear regression model is trained **strictly** on transitions targeting semesters prior to $t$ ($\max(\text{training target semester}) < t$).
2. **Benchmark Comparison**: For the exact same test transitions, the **Persistence Baseline** ($\hat{s}_t = s_{t-1}$) is evaluated against the observed ground truth.
3. **Paired Observation Pooling**: The primary comparison metrics are pooled directly across paired test observations where both models generated valid predictions.

### 4.2 How to Interpret Evaluation Metrics:
* **MAE (Mean Absolute Error)**: Average absolute gap between forecasted and actual SGPA, expressed in genuine grade points (e.g., $0.18$ grade points).
* **RMSE (Root Mean Squared Error)**: Quadratic penalty emphasizing larger prediction errors. Always $\ge \text{MAE}$.
* **$\Delta_{\text{MAE}}$ (Relative Improvement)**:
  $$\Delta_{\text{MAE}} = \frac{\text{MAE}_{\text{baseline}} - \text{MAE}_{\text{regression}}}{\text{MAE}_{\text{baseline}}} \times 100\%$$
  - **Positive $\Delta$**: Linear regression out-predicted the student's previous grade on historical holdouts.
  - **Zero or Negative $\Delta$**: Linear regression failed to beat persistence; the previous semester's grade remains the empirically superior forecast.
* **Academic Caveat**: Backtest performance on past semesters illustrates historical transition consistency, but does not guarantee future forecasting accuracy.

---

---

## 5. Workflow 3: Individual Student Trajectory Prediction (Phase 6 Active)

The Individual Prediction workflow allows students and advisors to forecast the next semester's SGPA without requiring a whole-class dataset when using the individual trend model:

1. **Navigate to Predictions Tab**:
   - Click the **Predictions** tab on the top navigation bar.
   - Select **👤 Individual Student Trajectory** sub-tab.
2. **Configure Semester Observation History**:
   - Enter between 3 and 7 observed semester numbers and their corresponding SGPA values.
   - Click **+ Add Observation Row** (up to 7 max) or **✕** to remove rows (down to 3 min).
   - Alternatively, click **Sample 4-Sem History** to pre-fill a representative trajectory.
   - Duplicate semester numbers and out-of-scale values are automatically rejected with actionable error messages.
3. **Select Forecasting Method**:
   - **Model C (Individual Least-Squares Trend)**: Fits $s_k = a + b\,k$ directly across the student's entered history. Does NOT require any class dataset.
   - **Model B (Shared Class-Wide Linear Regression)**: Evaluates $\hat{s}_{t+1} = a + b\,s_t$ using the student's latest observed SGPA. Only enabled when an accepted class dataset with valid consecutive transitions is in memory.
   - **Model A (Persistence Baseline)**: Predicts $\hat{s}_{t+1} = s_t$ using the latest observed SGPA as a neutral reference.
4. **Inspect Forecast Results**:
   - **Target Semester**: Evaluated at $k_{\text{target}} = k_{\text{latest}} + 1$.
   - **Raw Predicted SGPA**: Displayed to 4 decimal places. Out-of-scale predictions ($< 0.00$ or $> 4.00$) are preserved unclipped with an explicit amber warning badge.
   - **Degrees of Freedom & Volatility Warning**: For Model C, residual degrees of freedom ($\nu = K - 2$) and critical $t$-values are displayed. Histories of 3 or 4 semesters display volatility warnings.
   - **Method Explanation**: Details formula, sample counts, and an academic disclaimer that curve fit does not confer statistical certainty.
5. **Download Individual CSV**:
   - Click **📥 Download Individual Result (.csv)** to save a client-side RFC-4180 CSV containing metadata, model parameters, and entered observations.

---

## 6. Workflow 4: Whole-Class Batch Forecasting (Phase 6 Active)

The Whole-Class Prediction workflow forecasts next-semester SGPA for all students in an accepted cohort dataset:

1. **Ensure Dataset is Accepted**:
   - If no dataset is in session, the view displays an empty state with a direct button to **Dataset Management**.
2. **Access Whole-Class Cohort Prediction**:
   - Click **👥 Whole-Class Cohort Prediction** sub-tab.
3. **Review Summary KPIs**:
   - Total Cohort Students ($N$).
   - Successfully Forecasted count.
   - Out-of-Range Estimates count.
   - Unavailable / Gapped student count.
4. **Inspect and Filter the Prediction Table**:
   - Filter buttons allow toggling between **All Students**, **Valid Forecasts**, **Out of Scale**, and **Unavailable**.
   - Search box filters rows dynamically by `student_key`.
   - Click table headers (`Student Key`, `Latest SGPA`, `Target Sem`, `Predicted SGPA`) to sort ascending or descending.
   - Compare the **Regression Prediction** with the **Persistence Baseline** for every student side-by-side.
5. **Export Safe Cohort CSV**:
   - Click **📥 Export CSV** to download `cohort_predictions_class_YYYY-MM-DD.csv`.
   - The export contains only pseudonymous keys (`student_key`) and prediction metrics; zero personal identifying information (PII) is included.
   - Missing/unavailable predictions are exported as empty fields, never as zero.

---

## 7. Workflow 5: Privacy-Preserving OCR Ingestion & Key Reconciliation (Phase 7 Active)

The OCR Ingestion workflow extracts SGPA columns from scanned result sheets (PDF or image) with mandatory human auditing:

1. **Navigate to OCR Ingestion Tab**:
   - Click **OCR Ingestion** in the navigation header (`#tab-btn-ocr`).
2. **Upload or Preview Document**:
   - Drag and drop a university marksheet file (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp` up to 15 MB) onto the dropzone.
   - Or click **Load Synthetic Demo Marksheet** to instantly populate an in-memory test marksheet.
3. **Select Page & Adjust Orientation**:
   - For multi-page PDFs, use the **Page ◀ / ▶** controls to select the target semester result page.
   - Click **↻ Rotate 90°** if the document scan is sideways or upside down.
4. **Isolate the SGPA Column Boundary**:
   - Drag the red bounding box to cover **ONLY the SGPA numeric column**.
   - **Privacy Boundary**: Ensure all student names, registration numbers, CGPA, and course grades are excluded. Only the cropped sub-region is passed to the OCR engine.
   - Click **⚡ Run Local OCR on Crop**.
5. **Audit Candidate Values & Reconcile Student Keys**:
   - Set the **Semester Number** for the marksheet (e.g. Semester 2).
   - Review extracted numbers. Notice that proposed decimal fixes (e.g., `376` $\to$ `3.76`) and low-confidence cells are explicitly highlighted with amber badges for human review.
   - **Key Reconciliation**: For each row, select the student's existing stable pseudonymous key (`SYN_001`, `SYN_002`, etc.) from the dropdown, or choose `+ New Student Key...` if introducing a new student.
   - Never assume row order maps to identity. You may consult an offline official roster to perform this mapping.
   - Click **+ Add Missing Student Row** or **✕ Delete** to handle anomalies.
6. **Atomic Dataset Commitment**:
   - Click **✓ Confirm & Commit to Dataset**.
   - The system checks for collisions (e.g., duplicate entries for the same student in that semester) and atomically merges the new rows into the active accepted dataset.
   - If validation fails, your previously accepted data remains 100% untouched.
   - Upon confirmation, temporary OCR canvases and text buffers are immediately purged from memory.
7. **Downstream Integration**:
   - Click **📊 View Updated Predictions** or **📁 Inspect in Dataset Management** to immediately explore the updated dataset and forecasts.

---

## 8. Workflow 6: Analytical Dashboard & Data Visualization (Phase 8 Active)

The Analytical Dashboard provides interactive visualizations and mathematical insights into the accepted dataset:

1. **Accessing the Dashboard**:
   - Click **Dashboard** in the top navigation bar (`#tab-btn-dashboard`).
   - If no dataset is active in session memory, an educational empty state is displayed with options to load synthetic data or proceed to ingestion.
2. **Reviewing Cohort Overview KPIs**:
   - View total unique students, accepted records count, observed semester span, valid 1-step transitions, and model status.
   - Any student records with missing semester gaps are highlighted with non-bridging warnings.
3. **Exploring Sub-Tab Visualizations**:
   - **Transitions & Regression (`📈 Transitions & Regression`)**:
     - Interactive SVG scatter plot displaying prior SGPA ($s_t$) against subsequent SGPA ($s_{t+1}$).
     - Crimson solid line represents the fitted class-wide linear regression model ($s_{t+1} = a + b\,s_t$).
     - Grey dashed line shows the persistence baseline null hypothesis ($y = x$).
     - Hover or focus on points to inspect exact student keys, transition semesters, and in-sample residuals.
     - Toggle between the responsive SVG scatter chart and an accessible data table.
     - Lower panel displays the **In-Sample Residual Plot** ($\hat{y}_i$ vs $e_i = y_i - \hat{y}_i$) with a zero reference line and descriptive statistics (mean $\approx 0$, std dev, median, IQR).
   - **Semester Distributions (`📊 Semester Distributions`)**:
     - Use the semester selector pills (`Sem 1`, `Sem 2`, etc.) to switch observed semesters.
     - View the 8-bin frequency histogram over $[0.00, 4.00]$ with counts on each bar.
     - Inspect the Tukey boxplot showing median ($Q_2$), first quartile ($Q_1$), third quartile ($Q_3$), whiskers, and individual outlier points marked with amber dots.
     - Review distribution summary statistics: Count, Mean, Std Dev, Min, $Q_1$, Median, $Q_3$, Max, and IQR.
   - **Temporal Evaluation (`🛡️ Temporal Evaluation`)**:
     - Displays historical expanding-window cross-validation evidence from Phase 5.
     - Paired comparison cards show Regression MAE/RMSE vs. Persistence Baseline MAE/RMSE over identical test transitions.
     - Side-by-side bar chart compares model errors with an emerald/amber superiority conclusion tag.
     - Chronological fold breakdown table details training size, test size, paired comparisons, and $\Delta\%$ error per target semester.
   - **Transition Matrix (`🔲 Transition Matrix`)**:
     - $K \times K$ table displaying availability counts for every pair of semesters.
     - Valid 1-step consecutive pairs ($t \to t+1$) are highlighted in crimson with student counts.
     - Non-consecutive jumps (e.g. Sem 1 $\to$ Sem 3) are strictly flagged as `Gap (0)` to demonstrate enforcement of non-bridging rules.
   - **Review Candidates (`🔍 Review Candidates`)**:
     - Table listing observations flagged by the deterministic 1.5x IQR rule across semester distributions and in-sample residuals.
     - Displays student key, category, context, observed value, expected bounds, and auditor guidelines.
     - **Important**: Flagged points are strictly review candidates for transcript verification and are never deleted or modified automatically.

---

## 9. Workflow 7: Numerical Methods Educational Laboratory (Phase 9 Active)

The Educational Laboratory connects ClassPredict directly to the undergraduate CSE Numerical Methods curriculum through interactive experiments, step-by-step matrix reduction traces, and mathematical proofs.

### 1. Accessing the Laboratory
* Click **Numerical Lab** in the top navigation bar (`#tab-btn-lab`).
* Select any of the 5 experiment sub-tabs at the top of the workspace.

### 2. Experiment A: Gaussian Elimination with Row Partial Pivoting
* **Selecting Presets**:
  * Use the **Preset** dropdown to choose from illustrative linear systems:
    * *Standard Well-Conditioned (3×3)*: Integer solution $[1, 2, 3]$ showing standard row operations.
    * *Zero Pivot Row Swap (2×2)*: Zero in $A_{0,0}$ forces a partial pivoting row swap to avoid division by zero.
    * *Ill-Conditioned Near-Collinear (3×3)*: Nearly proportional rows exhibiting small pivots.
    * *Analytically Singular (3×3)*: Linearly dependent rows that fail scale-aware relative pivot tolerance ($\tau < 10^{-14} \cdot s_{\text{scale}}$).
* **Stepping Through Reduction**:
  * Use the step control buttons:
    * `|◀ First`: Return to the initial augmented system $[A | \mathbf{b}]$.
    * `◀ Prev` / `Next ▶`: Step forward or backward through pivot selection, row swaps, row eliminations, and back substitution.
    * `Last ▶|`: Jump directly to the final upper-triangular form and computed solution.
  * The step description card details the current pivot value, row swap status, multiplier $m_{ik} = a_{ik}/a_{kk}$, and exact elementary row operation $R_i \leftarrow R_i - m_{ik} R_k$.
* **Inspecting Solutions & Residuals**:
  * Inspect the computed solution vector $\mathbf{x} = [x_1, \dots, x_n]$.
  * Review the Euclidean residual norm $\|\mathbf{r}\|_2 = \|\mathbf{b} - A\hat{\mathbf{x}}\|_2$ to assess backward error.

### 3. Experiment B: Linear vs. Quadratic Least-Squares Regression
* **Selecting or Importing Data**:
  * Choose between built-in synthetic datasets (*Linear Trend*, *Parabolic Dip & Recovery*, *Diminishing Returns Plateau*) or select *Current Cohort Transitions* to test against active dataset records.
* **Comparing Model Fits**:
  * View the interactive SVG plot:
    * Amber dots: Observed data points.
    * Solid Crimson line: First-order linear fit $y = a_0 + a_1 x$.
    * Dashed Cyan curve: Second-order quadratic fit $y = a_0 + a_1 x + a_2 x^2$.
  * Click **Show Data Table** to inspect exact coordinates, fitted values, and individual residuals.
* **Mathematical Takeaways**:
  * Inspect the Residual Sum of Squares (RSS) and Mean Squared Error (MSE) for both models.
  * Note how the quadratic model always achieves lower or equal RSS on training data due to parameter flexibility.
  * Review the **Overfitting Warning Card**: Understand why lower training RSS does not imply superior future forecasting accuracy.
  * Review the centered normal equations $(X'^T X')\mathbf{c} = X'^T \mathbf{y}$ and condition squaring explanation $\kappa_2(X^T X) = (\kappa_2(X))^2$.

### 4. Experiment C: Newton Divided-Difference Interpolation
* **Selecting Presets & Nodes**:
  * Choose from *Known Parabola (3 Points)*, *Student Trajectory (4 Points)*, or *Alternating Grades (5 Points)*.
* **Inspecting the Triangular Table**:
  * The divided-difference table displays column-by-column recurrence values $f[x_i, \dots, x_{i+k}]$.
  * The highlighted top row represents the Newton polynomial coefficients $c_0, c_1, \dots, c_n$.
* **Evaluating Points & Extrapolation Boundaries**:
  * Enter a query coordinate $x$ into the **Query Coordinate** field and click **Evaluate P(x)**.
  * Click **Show Terms Table** to see the term-by-term breakdown $c_k \prod (x - x_j)$ and running sum.
  * If $x$ falls outside the node interval $[x_{\min}, x_{\max}]$, the system flags an amber `EXTRAPOLATION` badge, explaining why polynomial extrapolation outside the data hull is mathematically hazardous.

### 5. Experiment D: Runge Phenomenon & Extrapolation Risk
* **Simulating Runge's Function**:
  * Evaluates $f(x) = \frac{1}{1 + 25x^2}$ over the interval $x \in [-1, 1]$.
  * Select node counts from $N = 5$ to $N = 13$ (polynomial degrees 4 to 12).
* **Equally Spaced vs. Chebyshev Density**:
  * Select **Equally Spaced**: Notice how higher degrees cause catastrophic edge oscillations near $x \approx \pm 1$, with maximum errors exceeding $1.00$.
  * Select **Chebyshev Density**: Notice how clustering nodes near the endpoints drastically suppresses edge oscillations.
* **Curriculum Takeaway**:
  * Demonstrates that passing *exactly* through all data nodes does not prevent wild oscillations between nodes.
  * Validates why ClassPredict strictly uses low-order least squares for SGPA forecasting instead of high-degree polynomial interpolation.

### 6. Numerical Stability Topics
* Access the **Numerical Stability Topics** sub-tab to review reference cards on:
  * Round-off vs. Truncation Error.
  * Residual Vector ($\mathbf{r} = \mathbf{b} - A\hat{\mathbf{x}}$) vs. Solution Error ($\mathbf{e} = \mathbf{x} - \hat{\mathbf{x}}$).
  * Normal Equations Condition Squaring ($\kappa_2(X^T X) = (\kappa_2(X))^2$).
  * Exact Interpolation vs. Least-Squares Curve Fitting.

---

## 10. Planned Future Workflows (Scheduled Milestones)

* **Phase 10**: Production Packaging, Static Hosting, & Final Capstone Release.

