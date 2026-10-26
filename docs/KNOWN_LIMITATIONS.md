# Known Limitations & Academic Risk Assessment — Gradivue

> **Document ID**: DOC-LIM-001  
> **Status**: Approved & Implemented (Phase 10 Production Release Verified)  
> **Lifecycle State**: Deployed & Verified  
> **Last Updated**: October 2026

---

## 1. Academic & Statistical Honesty Notice

In academic software engineering and numerical analysis, acknowledging limitations is a hallmark of scientific rigor. **Gradivue** does not claim to possess prophetic insight into human academic potential; rather, it provides a transparent mathematical baseline based on historical transition mechanics.

The key limitations, assumptions, and mathematical constraints of the system are documented below.

---

## 2. Statistical & Dataset Constraints

### 2.1 Small Sample Size & Cohort Specificity
* **Limitation**: A university class typically consists of 40 to 80 students. Across 4 semesters, this generates only 120 to 240 transition records.
* **Impact**: While sufficient for fitting a 2-parameter linear regression model ($y = a + b\,x$), this sample size has low statistical power. A single anomalous semester (e.g., severe syllabus changes, departmental grading curve shifts, or exam disruptions) can skew the global slope $b$.
* **Non-Generalizability**: A transition model fitted on a 2024 Computer Science cohort cannot be reliably applied to an Electrical Engineering cohort or students at a different university.

### 2.2 Violation of the I.I.D. Assumption (Autocorrelation)
* **Limitation**: Standard ordinary least-squares regression assumes that observations are Independent and Identically Distributed (i.i.d.).
* **Impact**: In ClassPredict, transitions $(s_1 \to s_2)$ and $(s_2 \to s_3)$ from `STU_001` originate from the same human individual. Repeated measures exhibit positive autocorrelation. While the regression coefficients $\mathbf{\beta} = [a, b]^T$ remain unbiased, calculated standard errors and confidence intervals are slightly optimistic.

### 2.3 Non-Stationarity of Semester Difficulties
* **Limitation**: Model B models a unified transition rule $s_{t+1} = a + b\,s_t$ across all semester pairs.
* **Impact**: In reality, semester difficulty is non-stationary. In many engineering curricula, Semester 3 (Data Structures, Discrete Math) is significantly harder than Semester 1 (Introductory Physics, English). A single transition slope cannot capture differing curricular hurdles across semesters.

### 2.4 Small-Cohort Temporal Backtesting & Insufficient Early Folds
* **Limitation**: In small cohorts or early-semester histories ($K \le 3$), early folds lack sufficient historical transitions to train regression models ($M_{\text{train}} < 2$).
* **Target Semester 2 Rule**: Target semester 2 can never be evaluated via regression because zero earlier transitions exist. For cohorts with 3 completed semesters, only a single fold (target semester 3) can be evaluated.
* **Integrity Guarantee**: ClassPredict explicitly flags insufficient folds (`INSUFFICIENT_TRAINING_DATA`), preserves baseline evaluation, and never manufactures synthetic metrics or substitutes persistence as regression.
* **Metric Realism**: MAE and RMSE are expressed strictly in SGPA units. Lower historical error does not guarantee future forecasting accuracy.

---

## 3. Numerical & Algorithmic Limitations

### 3.1 Normal Equations Conditioning & Scale-Aware Mitigation
* **Limitation**: Solving least squares via $(X^T X)\mathbf{\beta} = X^T \mathbf{y}$ squares the condition number: $\kappa(X^T X) = (\kappa(X))^2$.
* **Scale-Dependence of Determinants**: Determinant magnitude cannot be used as a standalone indicator of singularity because $\det(c A) = c^n \det(A)$. A well-conditioned matrix with small entries can have a tiny determinant, while an ill-conditioned matrix with large entries can have a large determinant.
* **Mitigation Strategy**: The system relies on input variance checks ($\text{Var}(x) < 10^{-12}$), predictor centering ($x - \bar{x}$) to decouple off-diagonal covariance, and scale-aware relative pivot validation ($|a_{pk}| \ge 10^{-14} s_{\text{scale}}$) in Gaussian elimination, falling back safely to Model A (Persistence Baseline) when rank deficiency is detected.
* **Partial Pivoting Reality**: While row partial pivoting strictly bounds multiplier growth ($|m_{ik}| \le 1$), it cannot cure an inherently collinear or ill-conditioned system.

### 3.2 Individual Trend Uncertainty & Degrees of Freedom
* **Limitation**: Fitting Model C ($s_k = a + b\,k$) on short histories provides minimal residual degrees of freedom ($\nu = K - 2$).
* **Statistical Impact**: For $K = 3$ semesters, $\nu = 1$, and the two-sided $95\%$ Student's $t$ critical value is $t_{0.025, 1} = 12.706$. An isolated fluctuation heavily distorts the slope.
* **Policy**: The system does not assert an arbitrary threshold without evidence; it issues an explicit statistical volatility warning card detailing $\nu = K - 2$ and $t$-critical multipliers when $K < 5$.

### 3.3 Runge's Phenomenon in Polynomial Interpolation
* **Limitation**: High-degree polynomial interpolation ($P_n(x)$) evaluated at $x = K + 1$ suffers from severe edge oscillations.
* **Impact**: It is mathematically invalid to extrapolate polynomial interpolants for grade forecasting.
* **Mitigation**: ClassPredict strictly confines polynomial interpolation to the educational laboratory (FR-07) and prohibits its use in production forecasting.

---

## 4. OCR & Ingestion Constraints (Phase 7 Implemented)

### 4.1 Dependency on Scan Quality, Contrast, & Missing Decimals
* **Limitation**: Client-side OCR via Tesseract.js in WebAssembly depends on image resolution, contrast, and font clarity.
* **Missing Decimals**: Dot-matrix printer artifacts often cause period characters to disappear (e.g. `3.76` recognized as `376`).
* **Mitigation**: The OCR engine explicitly flags integers with proposed decimal adjustments (e.g. `376` $\to$ proposed `3.76` with status `AMBIGUOUS`), requiring human auditor confirmation before commitment. Never silently replaces unreadable rows with zero.

### 4.2 Non-Inference of Student Identities Across Sheets
* **Limitation**: Physical row order on university result sheets varies between semesters due to student dropouts, re-admissions, or differing sorting criteria.
* **Mitigation**: The system strictly forbids automatically assigning keys based on OCR row position across separate sheets. An explicit key reconciliation mapping step is required. Missing mappings block dataset confirmation (`TC-OCR-21`).

### 4.3 Browser Memory Constraints
* **Limitation**: Rendering multi-page PDFs to high-DPI canvases in client browser memory can consume significant RAM.
* **Mitigation**: Uploaded documents are capped at $15\text{MB}$ and maximum canvas dimensions of $8000\text{px}$. Documents are rendered one selected page at a time, and `discardTemporaryState()` wipes canvas pixel arrays upon completion or discard.

### 4.4 Inbound CDN Asset Dependencies
* **Limitation**: Tesseract.js WebAssembly workers and the English OCR language model (`eng.traineddata`) are fetched from CDNs on initial load.
* **Mitigation**: While zero user data is ever transmitted, the application requires internet access during the initial load until browser caching takes effect. For air-gapped environments, assets can be locally vendored.

---

## 6. Dashboard & Data Visualization Constraints (Phase 8 Implemented)

### 6.1 In-Sample Residual Fit vs. Out-of-Sample Predictive Generalization
* **Limitation**: The scatter plot and residual visualization represent in-sample fitted values ($\hat{y}_i = a + b\,s_{t, i}$) and training residuals ($e_i = y_i - \hat{y}_i$).
* **Statistical Distinction**: For ordinary linear least squares fitted with centered normal equations, the sum of in-sample residuals is mathematically zero ($\sum_{i=1}^M e_i = 0$) within machine precision ($< 10^{-12}$). A small residual standard deviation indicates goodness of fit on the *existing* cohort transitions, but provides no guarantee of future predictive accuracy on unseen semesters or future cohorts.
* **Mitigation**: The residual chart and summary cards explicitly label in-sample metrics as training diagnostics, strictly distinguishing them from out-of-sample temporal holdout validation errors (Phase 5).

### 6.2 Small-Sample Quantile & Boxplot Discretion
* **Limitation**: Estimating quartiles ($Q_1, \text{Median}, Q_3$) and Tukey whiskers on small semester cohorts ($n < 4$) yields volatile empirical distributions.
* **Mitigation**: The system enforces an explicit sample size policy: if a semester has $n < 4$ valid records, boxplot calculation is suspended, and the user is presented with an informational notice displaying the raw observation count and mean, avoiding misleading whisker representations. When $n \ge 4$, calculations use documented R Type 7 / Excel `PERCENTILE.INC` linear quantile interpolation.

### 6.3 Unusual Observations as Review Candidates, Never Automated Deletions
* **Limitation**: Applying Tukey's $1.5 \times \text{IQR}$ rule identifies statistical extremes ($x < Q_1 - 1.5\text{IQR}$ or $x > Q_3 + 1.5\text{IQR}$). In academic data, an extreme SGPA or sudden grade drop can represent legitimate student performance fluctuations rather than transcription errors.
* **Mitigation**: The system strictly treats flagged records as *review candidates*. The application forbids automated deletion, modification, or filtering of flagged observations. Auditor inspection is restricted to pseudonymous student keys and contextual boundaries.

### 6.4 Transition Matrix Gap Exclusion
* **Limitation**: Incomplete student histories (e.g., medical leave, repeat semesters) create gaps (e.g., student observed in Semester 1 and Semester 3, but missing Semester 2).
* **Policy**: The $K \times K$ transition matrix strictly counts consecutive one-step transitions ($t \to t+1$). Gaps where $c - r > 1$ are non-consecutive jumps and are strictly zeroed and designated as `Gap (0)` / `GAP_SKIPPED`, preventing the creation of artificial transition records.

---

## 7. Numerical Methods Educational Laboratory Constraints (Phase 9 Implemented)

### 7.1 Educational Matrix Dimension Bounds ($2 \times 2$ to $5 \times 5$)
* **Limitation**: The interactive Gaussian elimination laboratory restricts matrix dimensions to square systems between $2 \times 2$ and $5 \times 5$.
* **Rationale**: Pedagogical clarity in step-by-step augmented matrix tables and elimination multipliers requires immediate cognitive comprehension. Larger dense matrices ($n > 5$) overwhelm standard browser viewports and table layouts without adding educational insight regarding partial pivoting or back substitution.
* **Mitigation**: Larger linear systems in production (e.g. higher-order models if ever authorized) would use dense LU decomposition or QR factorization, whereas ClassPredict's production forecasting models require at most $2 \times 2$ normal equations.

### 7.2 Normal Equations Condition Squaring in Polynomial Regression
* **Limitation**: Solving least-squares problems via the normal equations $(X^T X)\boldsymbol{\beta} = X^T \mathbf{y}$ squares the $L_2$ condition number of the design matrix: $\kappa_2(X^T X) = (\kappa_2(X))^2$.
* **Numerical Consequence**: For poorly scaled, high-degree, or nearly collinear predictors, $\kappa_2(X^T X)$ can exceed $10^{15}$, causing complete loss of precision in IEEE-754 double precision arithmetic.
* **Mitigation in Laboratory**: Predictor centering ($x' = x - \bar{x}$) is rigorously applied to diagonalize the first two columns of $X'^T X'$:
  $$X'^T X' = \begin{bmatrix} M & 0 & \sum x'^2 \\ 0 & \sum x'^2 & \sum x'^3 \\ \sum x'^2 & \sum x'^3 & \sum x'^4 \end{bmatrix}$$
  The uncentered coefficients are recovered algebraically without forming the raw $X^T X$. Systems with $\text{Var}(x) < 10^{-12}$ or rank deficiency are explicitly rejected without fabricating solutions.

### 7.3 High-Degree Polynomial Extrapolation Divergence & Runge's Phenomenon
* **Limitation**: Newton divided-difference interpolation guarantees exact node matching ($P_n(x_i) = y_i$), but does not guarantee bounded behavior between nodes or outside the convex hull $[x_{\min}, x_{\max}]$.
* **Runge Divergence**: On equally spaced nodes over $[-1, 1]$ for Runge's function $f(x) = \frac{1}{1 + 25x^2}$, the interpolation polynomial oscillates wildly near the boundaries with maximum error growing exponentially:
  $$\lim_{n \to \infty} \max_{x \in [-1, 1]} |f(x) - P_n(x)| = \infty$$
* **Chebyshev Node Moderation**: Clustering nodes at Chebyshev zeros $x_k = \cos\left(\frac{2k+1}{2(n+1)}\pi\right)$ suppresses interior and edge oscillations within $[-1, 1]$, but forward extrapolation outside $[-1, 1]$ still diverges rapidly at rate $\mathcal{O}(x^{n+1})$.
* **Pedagogical Rationale**: This controlled demonstration provides the definitive academic justification for why Gradivue uses low-degree least-squares regression rather than high-order polynomial interpolation for semester SGPA forecasting.

### 7.4 In-Sample RSS Overfitting Hazard in Small Samples
* **Limitation**: In Experiment B, the quadratic model ($d = 2$, 3 parameters) mathematically yields a residual sum of squares that is less than or equal to the linear model ($d = 1$, 2 parameters) on the same training data: $\text{RSS}_{\text{quad}} \le \text{RSS}_{\text{lin}}$.
* **Statistical Pitfall**: Students frequently conflate a smaller training RSS with superior forecasting power. When observations are few ($M \le 5$), the quadratic model fits random noise and measurement artifacts.
* **Mitigation**: The laboratory displays an explicit **Overfitting Alert & Model Selection Warning** card detailing the trade-off between training fit and out-of-sample generalization error, reinforced by degrees-of-freedom penalization concepts ($s^2 = \text{RSS}/(M - p)$).

---

## 8. Scope & Pedagogical Boundaries

1. **No CGPA or Credit Weighting**: Gradivue intentionally restricts scope to SGPA. Calculating Cumulative GPA requires parsing individual course credit weights, grading policies, and repeat-course forgiveness rules, which vary by institution.
2. **No Persistent Cloud Database**: Academic records are held strictly in ephemeral browser memory. While optimal for privacy, this requires users to re-import CSV files when opening a new session.
3. **Local HTTP Server Requirement**: Because the application utilizes native ES6 JavaScript modules, running locally requires a lightweight HTTP server (e.g., Python `http.server` or Node `npx serve`) to satisfy browser CORS security policies.
4. **Brand-Name Clearance and Domain Availability**: The official product name "Gradivue" has not undergone formal multi-jurisdictional trademark registration clearance or commercial domain acquisition checks. This status is recorded as a documented limitation; local application rebranding, pre-deployment hardening, and static subpath hosting proceed safely without waiting for separate commercial or legal clearance.

