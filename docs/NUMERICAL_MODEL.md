# Numerical Model Specification — ClassPredict

> **Document ID**: DOC-NUM-001  
> **Status**: Approved & Implemented (Phase 9 Numerical Methods Laboratory Complete)  
> **Lifecycle State**: Implemented & Tested  
> **Last Updated**: October 2026  
> **Academic Subject**: CSE Undergraduate Numerical Methods Capstone

---

## 1. Mathematical Objective & Problem Formulation

The objective of **ClassPredict** is to approximate the transition mechanics governing undergraduate academic performance across sequential semesters:

$$s_{t+1} = f(s_t, \mathbf{h}_t) + \epsilon$$

where:
* $s_t \in [0.00, 4.00]$ is the observed SGPA at semester $t$.
* $s_{t+1}$ is the unknown SGPA of the subsequent semester.
* $\mathbf{h}_t = [s_1, s_2, \dots, s_{t-1}]$ represents the prior historical trajectory.
* $\epsilon$ represents stochastic disturbance (course difficulty variations, exam anomalies, individual life events).

In this project, we formulate, analyze, and test candidate models, investigate numerical conditioning, implement scale-aware singularity detection, and contrast exact polynomial interpolation with least-squares curve fitting.

---

## 2. Candidate Model Formulations

### 2.1 Model A: Persistence Baseline (The Null Benchmark)

$$\hat{s}_{t+1} = s_t$$

#### Mathematical Rationale:
In time-series and sequential forecasting, the persistence model (naive forecast) asserts that the most recent observed state is the best predictor of the immediate future state. In academic grading, a student who attained a 3.40 in Semester 3 has an empirical prior centered near 3.40 for Semester 4.

**Role in the Project**: Model A serves as the **mandatory benchmark**. Any statistical regression model that fails to achieve a lower Mean Absolute Error (MAE) or Root Mean Squared Error (RMSE) than Model A on temporal holdout data provides zero genuine predictive utility.

**Conditions for Fallback to Model A**:
Model A is deployed as an automatic fallback if and only if one of the following documented conditions is triggered:
1. **Zero / Near-Zero Cohort Variance**: The sample variance of input transitions satisfies $\text{Var}(x) < 10^{-12}$, making the linear system rank-deficient.
2. **Numerical Singularity**: The scale-aware pivot in Gaussian elimination falls below tolerance ($\tau < 10^{-14}$), preventing stable system solution.
3. **Non-Finite Arithmetic**: An intermediate matrix coefficient evaluates to `NaN` or `±Infinity`.
4. **Insufficient Transition Records**: The total number of consecutive historical transition pairs is $M < 2$.

---

### 2.2 Model B: Class-Wide Linear Regression (First-Order Transition)

$$s_{t+1} = a + b\,s_t + \epsilon$$

The parameter vector $\mathbf{\beta} = [a, b]^T$ is estimated using least-squares curve fitting over all valid consecutive transition pairs $(x_i, y_i) = (s_t^{(j)}, s_{t+1}^{(j)})$ across the cohort dataset.

#### Derivation of the Normal Equations:
Let the objective be to minimize the sum of squared residuals $S(a, b)$:

$$S(a, b) = \sum_{i=1}^M \left(y_i - (a + b\,x_i)\right)^2$$

Setting the partial derivatives with respect to $a$ and $b$ to zero:

$$\frac{\partial S}{\partial a} = -2 \sum_{i=1}^M \left(y_i - a - b\,x_i\right) = 0 \implies M\,a + b \sum_{i=1}^M x_i = \sum_{i=1}^M y_i$$

$$\frac{\partial S}{\partial b} = -2 \sum_{i=1}^M x_i \left(y_i - a - b\,x_i\right) = 0 \implies a \sum_{i=1}^M x_i + b \sum_{i=1}^M x_i^2 = \sum_{i=1}^M x_i y_i$$

In matrix notation, let $X \in \mathbb{R}^{M \times 2}$ be the design matrix and $\mathbf{y} \in \mathbb{R}^M$ the response vector:

$$X = \begin{bmatrix} 1 & x_1 \\ 1 & x_2 \\ \vdots & \vdots \\ 1 & x_M \end{bmatrix}, \quad \mathbf{\beta} = \begin{bmatrix} a \\ b \end{bmatrix}, \quad \mathbf{y} = \begin{bmatrix} y_1 \\ y_2 \\ \vdots \\ y_M \end{bmatrix}$$

Setting the gradient $\nabla_{\mathbf{\beta}} \|\mathbf{y} - X\mathbf{\beta}\|_2^2 = \mathbf{0}$ yields the **Normal Equations**:

$$(X^T X)\mathbf{\beta} = X^T \mathbf{y}$$

Expanding $(X^T X)$ and $X^T \mathbf{y}$:

$$\begin{bmatrix} M & \sum x_i \\ \sum x_i & \sum x_i^2 \end{bmatrix} \begin{bmatrix} a \\ b \end{bmatrix} = \begin{bmatrix} \sum y_i \\ \sum x_i y_i \end{bmatrix}$$

---

### 2.3 Model C: Individual Least-Squares Trend (Single-Student Trajectory)

$$s_k = a + b\,k + \epsilon_k$$

where $k$ is the actual integer semester number ($1 \le k \le 12$) and $s_k$ is the observed SGPA for that semester.

#### Mathematical Formulation & Forecast:
When an individual student’s unique trajectory is provided ($3 \le K \le 7$ observed semesters), Model C fits a straight-line trend directly across their recorded semesters $(k_i, s_{k_i})$ without requiring an active cohort dataset.

The forecast for the target semester $k_{\text{target}} = k_{\text{latest}} + 1$ is obtained by evaluating the fitted line:

$$\hat{s}_{\text{target}} = a + b\,k_{\text{target}}$$

#### Centered Solver Implementation:
To guarantee numerical conditioning, Model C computes centered semester numbers $k'_i = k_i - \bar{k}$:

$$b = \frac{\sum_{i=1}^K (k_i - \bar{k})(s_{k_i} - \bar{s})}{\sum_{i=1}^K (k_i - \bar{k})^2}, \quad a = \bar{s} - b\,\bar{k}$$

#### Degrees of Freedom & Statistical Volatility Policy:
A critical tenet of numerical methods is distinguishing mathematical existence from empirical reliability. For $K$ observations, fitting a 2-parameter line leaves only $\nu = K - 2$ residual degrees of freedom:

| Observations ($K$) | Residual d.o.f. ($\nu = K - 2$) | Two-Tailed $t_{0.025, \nu}$ | Statistical Volatility Level | Explicit Warning Policy |
| :---: | :---: | :---: | :---: | :--- |
| **$K = 3$** | $\nu = 1$ | $12.706$ | **Extreme Volatility** | An isolated outlier or single irregular course heavily levers the fitted slope. |
| **$K = 4$** | $\nu = 2$ | $4.303$ | **High Volatility** | Trend exhibits high sensitivity to individual semester fluctuations. |
| **$K = 5$** | $\nu = 3$ | $3.182$ | **Moderate Volatility** | Moderate stability; residual variation remains noticeable. |
| **$K \ge 6$** | $\nu \ge 4$ | $\le 2.776$ | **Adequate Horizon** | Baseline individual trajectory stability. |

**Unclipped Raw Prediction Policy**: If the mathematical evaluation $\hat{s}_{\text{target}}$ exceeds the valid scale ($< 0.00$ or $> 4.00$), the raw numerical value is preserved and displayed alongside an amber warning badge. It is never silently clamped.

---

### 2.4 Numerical Stability, Conditioning & Defensible Singularity Strategy

A central requirement of this Numerical Methods project is to implement robust numerical conditioning analysis.

#### Why a Fixed Determinant Threshold ($\det < 10^{-7}$) is Mathematically Inadequate:
A common novice error is using a fixed threshold on the determinant (e.g., $\det(A) < 10^{-7}$) as the sole test for singularity. This is mathematically indefensible because **determinant magnitude is scale-dependent and dimension-dependent**:

$$\det(c A) = c^n \det(A)$$

For an $n \times n$ matrix:
- If all entries of a $2 \times 2$ matrix are scaled by $10^{-4}$ (e.g., due to choice of measurement units), the determinant scales by $(10^{-4})^2 = 10^{-8}$. The determinant is $< 10^{-7}$ even though the condition number $\kappa(A) = \|A\| \|A^{-1}\|$ is completely unchanged and the system is perfectly well-conditioned!
- Conversely, for a large matrix, entries can be moderately large while the columns are virtually collinear, producing a large determinant despite extreme ill-conditioning.

#### Defensible Multi-Stage Singularity & Conditioning Strategy:
To guarantee numerical stability, ClassPredict enforces a 5-layer validation strategy:

1. **Input Variance and Rank Pre-Check**:
   Before forming the Normal Equations, compute the sample mean $\bar{x} = \frac{1}{M}\sum x_i$ and sample variance:
   $$s_x^2 = \frac{1}{M}\sum_{i=1}^M (x_i - \bar{x})^2$$
   If $s_x^2 < \epsilon_{\text{var}}$ (with $\epsilon_{\text{var}} = 10^{-12}$), all input data points $x_i$ are identical within machine precision. The column of $x$ is collinear with the column of 1s in $X$, making $\text{rank}(X) = 1 < 2$. The system is analytically singular. Normal Equations must not be solved; fallback to Model A is triggered immediately with an explanatory diagnostic.

2. **Predictor Centering (Improving Matrix Conditioning)**:
   In uncentered Normal Equations, $\sum x_i$ creates large off-diagonal entries in $X^T X$, coupling the intercept and slope and inflating the condition number $\kappa(X^T X)$.
   By reparameterizing using centered predictors $x'_i = x_i - \bar{x}$:
   $$X' = \begin{bmatrix} 1 & x_1 - \bar{x} \\ 1 & x_2 - \bar{x} \\ \vdots & \vdots \\ 1 & x_M - \bar{x} \end{bmatrix} \implies (X'^T X') = \begin{bmatrix} M & 0 \\ 0 & \sum (x_i - \bar{x})^2 \end{bmatrix}$$
   Because $\sum (x_i - \bar{x}) = 0$, the off-diagonal covariance is identically zero! The centered system is completely decoupled and orthogonal, with condition number:
   $$\kappa_2(X'^T X') = \frac{\max(M, \sum (x_i - \bar{x})^2)}{\min(M, \sum (x_i - \bar{x})^2)}$$
   The slope is directly $b = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sum (x_i - \bar{x})^2}$, and the uncentered intercept is recovered via $a = \bar{y} - b\,\bar{x}$.

3. **Scale-Aware Pivot Tolerance in Gaussian Elimination**:
   When solving general systems $A\mathbf{x} = \mathbf{b}$ (e.g., $3 \times 3$ polynomial fitting in the educational lab), Gaussian Elimination must employ a **scale-aware relative pivot tolerance**:
   At elimination step $k$, let the matrix scale be characterized by the maximum absolute element in the active submatrix:
   $$s_{\text{scale}} = \max_{i, j \ge k} |a_{ij}^{(k)}|$$
   A candidate pivot $p$ is accepted if and only if:
   $$|a_{pk}^{(k)}| \ge \tau_{\text{rel}} \cdot s_{\text{scale}}$$
   where $\tau_{\text{rel}} = 10^{-14} \approx M \cdot \epsilon_{\text{mach}}$. If the largest available pivot in the column satisfies $|a_{pk}^{(k)}| < \tau_{\text{rel}} \cdot s_{\text{scale}}$, the matrix is numerically rank-deficient. The solver halts and throws `SingularMatrixException`.

4. **Non-Finite Arithmetic Check**:
   During forward elimination and back substitution, all intermediate computations are checked via `Number.isFinite()`. If any entry evaluates to `NaN`, `+Infinity`, or `-Infinity`, the solver aborts immediately.

5. **Partial Pivoting Limitations (Defensible Academic Disclaimer)**:
   Gaussian elimination with partial pivoting guarantees that row multipliers satisfy $|m_{ik}| \le 1$, which strictly bounds error growth in well-scaled matrices. However, **partial pivoting alone cannot fix an ill-conditioned system**. If the underlying mathematical problem has a condition number near $\epsilon_{\text{mach}}^{-1} \approx 10^{16}$, small perturbations in input grades inevitably lead to large perturbations in coefficients regardless of pivoting.

---

### 2.4 Comparison of Normal Equations vs. QR Factorization

In our viva defense and technical documentation, we explicitly document the trade-offs between Normal Equations and QR-based least squares:

| Dimension | Normal Equations ($(X^T X)\mathbf{\beta} = X^T \mathbf{y}$) | QR Factorization ($X = QR, R\mathbf{\beta} = Q^T \mathbf{y}$) |
| :--- | :--- | :--- |
| **Condition Number** | $\kappa_2(X^T X) = (\kappa_2(X))^2$ (Squares the condition number) | $\kappa_2(R) = \kappa_2(X)$ (Preserves condition number) |
| **Numerical Accuracy** | Loses up to half the significant digits in ill-conditioned cases | Retains full machine precision relative to $X$ |
| **Computational Cost** | $\approx M n^2 + \frac{1}{3}n^3$ flops (faster for $M \gg n$) | $\approx 2 M n^2 - \frac{2}{3}n^3$ flops via Householder |
| **Pedagogical Value** | Directly demonstrates syllabus topics: matrix multiplication, Normal Equations, and Gaussian Elimination with partial pivoting | More complex algorithm (Householder reflections / Givens rotations); often used as a black-box |
| **ClassPredict Role** | **Implemented in Core Engine** with centering and scale-aware singularity checks | **Documented as Gold Standard** in comparative literature |

---

### 2.5 Algorithm: Gaussian Elimination with Row Partial Pivoting & Scale-Aware Threshold

```text
Input: Augmented matrix A of size N x (N + 1)
Output: Solution vector x of size N

Constant: REL_TOL = 1e-14

Forward Elimination:
For k = 1 to N - 1:
    // 1. Compute submatrix scale
    submatrix_max = 0
    For i = k to N:
        For j = k to N:
            submatrix_max = max(submatrix_max, |A[i, j]|)
            
    If submatrix_max < REL_TOL:
        Raise SingularMatrixException("Matrix is completely zero or numerically rank-deficient")

    // 2. Find pivot row with largest entry in column k
    pivot_row = k
    max_pivot_val = |A[k, k]|
    For i = k + 1 to N:
        If |A[i, k]| > max_pivot_val:
            max_pivot_val = |A[i, k]|
            pivot_row = i

    // 3. Scale-aware pivot validation
    If max_pivot_val < REL_TOL * submatrix_max:
        Raise SingularMatrixException("Pivot below relative scale tolerance; system is singular")

    // 4. Swap rows if necessary
    If pivot_row != k:
        Swap row pivot_row and row k in A

    // 5. Eliminate entries below pivot
    For i = k + 1 to N:
        factor = A[i, k] / A[k, k]
        If not isFinite(factor):
            Raise NumericalInstabilityException("Non-finite factor during elimination")
            
        A[i, k] = 0 // Explicit zero
        For j = k + 1 to N + 1:
            A[i, j] = A[i, j] - factor * A[k, j]
            If not isFinite(A[i, j]):
                Raise NumericalInstabilityException("Non-finite value produced during elimination")

// Back Substitution:
If |A[N, N]| < REL_TOL * |A[N, N]|:
    Raise SingularMatrixException("Zero pivot in bottom diagonal")

x[N] = A[N, N + 1] / A[N, N]
If not isFinite(x[N]):
    Raise NumericalInstabilityException("Non-finite solution at bottom pivot")

For i = N - 1 down to 1:
    sum = 0
    For j = i + 1 to N:
        sum = sum + A[i, j] * x[j]
    x[i] = (A[i, N + 1] - sum) / A[i, i]
    If not isFinite(x[i]):
        Raise NumericalInstabilityException("Non-finite solution during back-substitution")

Return x
```

---

### 2.6 Model C: Individual Least-Squares Trend & Degrees of Freedom

For an individual student with a sequence of $K$ completed semesters $(k, s_k)$ for $k \in \{1, 2, \dots, K\}$:

$$s_k = a_{\text{ind}} + b_{\text{ind}}\,k + \epsilon_k$$

The forecast for semester $K + 1$ is:

$$\hat{s}_{K+1} = a_{\text{ind}} + b_{\text{ind}}(K + 1)$$

#### Statistical Warning Policy Based on Degrees of Freedom:
Rather than asserting an arbitrary "fewer than five semesters" threshold without justification, ClassPredict grounds its warning policy on **residual degrees of freedom**:

$$\nu = K - p = K - 2$$

where $K$ is the number of historical observations and $p = 2$ is the number of estimated parameters (intercept and slope).

| Semesters ($K$) | Degrees of Freedom ($\nu = K - 2$) | Two-Sided $t_{0.025, \nu}$ Critical Value | Uncertainty & Policy |
| :--- | :--- | :--- | :--- |
| **$K = 1$** | $\nu = -1$ | Undefined | **Prohibited**: Trend cannot be computed. Fallback to Persistence. |
| **$K = 2$** | $\nu = 0$ | Undefined | **Prohibited**: Exact line through 2 points; zero degrees of freedom; any noise creates huge extrapolation slope. |
| **$K = 3$** | $\nu = 1$ | $t = 12.706$ | **Extreme Volatility Warning**: Critical value is 12.7! Prediction interval is exceptionally wide. |
| **$K = 4$** | $\nu = 2$ | $t = 4.303$ | **High Volatility Warning**: Critical value is 4.3; single outlier semester heavily levers the slope. |
| **$K = 5$** | $\nu = 3$ | $t = 3.182$ | **Moderate Confidence**: First horizon where trend estimates achieve basic statistical stability. |
| **$K \ge 6$** | $\nu \ge 4$ | $t \le 2.776$ | **Adequate Sample Horizon**: Standard prediction interval applies. |

---

### 2.7 Model D: Experimental Degree-2 Polynomial Curve Fitting

$$s_k = a + b\,k + c\,k^2 + \epsilon_k$$

Fitting a parabola requires minimizing:

$$S(a, b, c) = \sum_{k=1}^K \left(s_k - (a + b\,k + c\,k^2)\right)^2$$

Setting partial derivatives with respect to $a, b, c$ to zero yields a $3 \times 3$ system of Normal Equations:

$$\begin{bmatrix} 
K & \sum k & \sum k^2 \\ 
\sum k & \sum k^2 & \sum k^3 \\ 
\sum k^2 & \sum k^3 & \sum k^4 
\end{bmatrix} 
\begin{bmatrix} a \\ b \\ c \end{bmatrix} 
= 
\begin{bmatrix} \sum s_k \\ \sum k\,s_k \\ \sum k^2\,s_k \end{bmatrix}$$

This $3 \times 3$ system is solved using our scale-aware Gaussian Elimination with partial pivoting.

#### Policy on Model D:
* Confined strictly to the **Numerical Methods Laboratory (FR-07)** as an educational experiment.
* Strictly prohibited as a production default forecaster. On histories of $K \le 5$, parabolic fits exhibit severe Runge-type curvature, frequently extrapolating impossible grades ($> 4.50$ or $< 1.50$).

---

## 3. Policy on Out-of-Range Predictions

In empirical forecasting, linear extrapolation can yield values outside the valid academic grading scale ($[0.00, 4.00]$):

1. **Raw Mathematical Prediction as Default**:
   The default UI **must always display the exact raw mathematical prediction** (e.g., `4.18` or `-0.15`).
2. **Never Silently Clip**:
   Silently replacing $4.18$ with $4.00$ conceals model behavior and misinforms evaluators about model error.
3. **Explicit Out-of-Bounds Warning**:
   Whenever a raw prediction $\hat{s}$ satisfies $\hat{s} < 0.00$ or $\hat{s} > 4.00$, the interface displays an amber warning badge:
   `⚠️ Mathematical extrapolation (4.18) exceeds the configured scale [0.00, 4.00].`
4. **Separately Labeled Bounded Reference**:
   If an institution requires understanding where the student stands relative to the maximum grade, a separate, distinct field labeled **"Bounded Domain Reference: 4.00"** may be displayed alongside an explanatory footnote: *(Note: Strictly bounded to the maximum institutional scale for reference; this is not the raw regression output).*

---

## 4. Newton Divided-Difference Interpolation (Laboratory Demonstration)

In the Numerical Methods Laboratory (FR-07), we demonstrate exact polynomial interpolation:

Given $n + 1$ points $(x_0, y_0), \dots, (x_n, y_n)$:

$$P_n(x) = f[x_0] + \sum_{i=1}^n f[x_0, \dots, x_i] \prod_{j=0}^{i-1}(x - x_j)$$

Divided differences:

$$f[x_i] = y_i, \quad f[x_i, \dots, x_{i+k}] = \frac{f[x_{i+1}, \dots, x_{i+k}] - f[x_i, \dots, x_{i+k-1}]}{x_{i+k} - x_i}$$

### Educational Contrast: Interpolation vs. Extrapolation
* **Interpolation ($x \in [x_0, x_n]$)**: Exact agreement with past grades ($P_n(x_i) = y_i$).
* **Extrapolation ($x = x_n + 1$)**: High-degree polynomials oscillate violently outside the data interval (Runge's phenomenon). Evaluating $P_n(K+1)$ on a 4-semester trajectory often yields SGPAs of $7.2$ or $-2.1$, demonstrating why regression curve fitting is required for forecasting.

---

## 5. Software Implementation & Function Contracts (Phase 4 Verified)

All numerical modules are implemented in pure vanilla ES6 JavaScript without external runtime dependencies or DOM references.

### 5.1 Linear System Solver (`js/core/linear_algebra.js`)

Solves the linear system $A\mathbf{x} = \mathbf{b}$ using Gaussian elimination with row partial pivoting and back substitution.

#### Function Contract:
```javascript
solveLinearSystem(A, b, options = { relativeTolerance: 1e-14 })
```
- **Inputs**:
  - `A` (`number[][]`): Square $n \times n$ coefficient matrix.
  - `b` (`number[]`): Length-$n$ right-hand side vector.
  - `options.relativeTolerance` (`number`, default $10^{-14}$): Relative pivot threshold.
- **Outputs**:
  - `x` (`number[]`): Solution vector of length $n$.
- **Error Handling**:
  - `DimensionMismatchError`: Thrown if $A$ is non-square or dimensions of $A$ and $b$ do not match.
  - `NonFiniteValueError`: Thrown if $A$ or $b$ contain `NaN` or `Infinity`, or if non-finite intermediate values are produced.
  - `SingularMatrixError`: Thrown if matrix is an all-zero matrix or if pivot $|M_{p,k}| < \tau_{\text{rel}} \cdot \|A\|_{\max}$.
- **Immutability Guarantee**: Deep clones inputs `A` and `b` prior to elimination. Callers' data is never mutated.
- **Complexity**:
  - Time: Forward elimination $O(n^3 / 3)$, back substitution $O(n^2 / 2)$. Total $O(n^3)$.
  - Space: $O(n^2)$ for matrix cloning.

### 5.2 Transition & Regression Engine (`js/core/regression_engine.js`)

#### 5.2.1 Consecutive Transition Construction:
```javascript
buildConsecutiveTransitions(records)
```
- **Inputs**: Array of records `{ student_key, semester_no, sgpa }`.
- **Outputs**: `{ transitions: ValidTransition[], totalTransitions, uniqueStudents, skippedGaps }`.
- **Transition Record Schema**:
  - `student_key` (`string`): Pseudonymous student identifier.
  - `from_semester` (`number`): Initial semester integer $t$.
  - `to_semester` (`number`): Consecutive semester integer $t + 1$.
  - `previous_sgpa` (`number`): SGPA at semester $t$.
  - `next_sgpa` (`number`): SGPA at semester $t + 1$.
- **Validation Rules**:
  - Only constructs transitions where `to_semester === from_semester + 1` for the same student.
  - Missing semester gaps (e.g. sem 1 and sem 3) are strictly tracked and skipped without inventing records.
  - Duplicate `(student_key, semester_no)` records are rejected.
  - Outputs are sorted deterministically: `student_key` ASC, `from_semester` ASC.
  - Input array and objects are never mutated.

#### 5.2.2 Persistence Baseline Predictor:
```javascript
predictPersistence(previousSgpa, config = { minSgpa: 0.00, maxSgpa: 4.00 })
```
- **Inputs**: `previousSgpa` (`number`), optional scale config.
- **Outputs**: `{ model: "PERSISTENCE_BASELINE", predictedSgpa, rawPrediction, isOutOfRange, warning }`.
- **Raw Policy**: $\hat{s}_{t+1} = s_t$. Result is never silently clamped. If outside configured scale, `isOutOfRange` is set to `true` with an explanatory warning.

#### 5.2.3 Linear Least-Squares Regression:
```javascript
fitLinearRegression(x, y, config = { minSgpa: 0.00, maxSgpa: 4.00 })
fitTransitionRegression(transitions, config)
```
- **Inputs**: Predictor array `x`, response array `y` (or `transitions` array).
- **Outputs**:
  - `intercept` ($a$), `slope` ($b$).
  - `meanX`, `meanY`, `sampleCount` ($M$).
  - `predictorRange`: `{ min, max }`.
  - `varianceX`, `rSquared`, `residuals` ($e_i$), `sumSquaredResiduals` ($S$), `mae`, `rmse`.
  - `predict(newX)`: Pure function returning `{ predictedSgpa, rawPrediction, isOutOfRange, isExtrapolating }`.
  - `metadata`: Method tag (`"ORDINARY_LEAST_SQUARES_CENTERED_GAUSSIAN"`), coordinate transformation parameters.
- **Numerical Conditioning & Singular Protection**:
  - Rejects $M < 2$ with actionable error.
  - Pre-checks predictor variance: if $\text{Var}(x) < 10^{-12}$, rejects fit with descriptive error.
  - Centers predictor $x' = x - \bar{x}$ before forming $X'^T X'$ to eliminate off-diagonal cross-terms.
  - Solves centered normal equations with `solveLinearSystem`.
  - Recovers intercept in original coordinates via $a = \bar{y} - b'\bar{x}$.
  - Never clamps predicted outputs; flags domain extrapolations when $x < \min(x)$ or $x > \max(x)$.

### 5.3 Newton Divided-Difference Interpolation (`js/core/interpolation_engine.js`)

Implemented as an independent educational laboratory module:
```javascript
computeDividedDifferences(xNodes, yNodes)
evaluateNewtonPolynomial(xNodes, coefficients, x)
fitNewtonInterpolation(xNodes, yNodes)
```
- **Inputs**: Distinct $x$-nodes and corresponding $y$-values.
- **Outputs**: Divided-difference coefficients $c_k = f[x_0, \dots, x_k]$, evaluation function, and exact point reproduction verification ($\max |P(x_i) - y_i| < 10^{-12}$).
- **Validation**: Rejects duplicate $x$ nodes ($|x_j - x_i| < 10^{-14}$) to prevent division by zero; validates finite numbers; tags out-of-interval evaluation as extrapolation.

### 5.4 Temporal Validation & Model Evaluation Engine (`js/core/temporal_validator.js`)

Implements rolling-origin temporal backtesting and empirical benchmarking of Class-Wide Linear Regression against the Persistence Baseline.

#### Function Contracts:
```javascript
computeMae(actual, predicted)
computeRmse(actual, predicted)
evaluateTemporalFolds(dataset, options = { minTrainingSamples: 2, minPredictorVariance: 1e-12, scaleMax: 4.00 })
```

#### Exact Temporal Split Rule:
For each target semester $t \in T_{\text{targets}}$:
- **Training Transitions**: Valid consecutive transitions where $\text{to\_semester} < t$.
  $$\max(\text{training target semester}) < t$$
  Strict temporal isolation: transitions targeting semester $t$ or later are mathematically prohibited from entering training.
- **Test Transitions**: Valid transitions where $\text{to\_semester} = t$.
- **Baseline Evaluation**: For every test transition, the Persistence Baseline predicts $\hat{s}_t^{\text{base}} = s_{t-1}$.
- **Regression Evaluation**: Linear regression is fitted strictly on the fold's training transitions using `fitTransitionRegression`.

#### Metric Definitions & Aggregation:
- **Mean Absolute Error (MAE)**:
  $$\text{MAE} = \frac{1}{n} \sum_{i=1}^n |y_i - \hat{y}_i|$$
- **Root Mean Squared Error (RMSE)**:
  $$\text{RMSE} = \sqrt{\frac{1}{n} \sum_{i=1}^n (y_i - \hat{y}_i)^2}$$
- **Relative Improvement ($\Delta$)**:
  $$\Delta_{\text{MAE}} = \frac{\text{MAE}_{\text{baseline}} - \text{MAE}_{\text{regression}}}{\text{MAE}_{\text{baseline}}} \times 100\%$$
- **Observation-Weighted Pooled Metrics**:
  Pooled MAE and RMSE are computed directly across pooled individual prediction records. They are **never** computed by taking an unweighted average of fold MAEs/RMSEs, preventing distortion from uneven fold sample sizes.
- **Fair Model Comparison**:
  Primary regression-vs-baseline comparison is computed strictly over paired test records where both models produced valid numerical forecasts.

#### Fold Statuses & Degenerate Handling:
- `EVALUATED`: Training set satisfied minimum sample ($M \ge \text{minTrainingSamples}$) and variance checks ($\text{Var}(x) \ge 10^{-12}$); model fitted and evaluated on test transitions.
- `INSUFFICIENT_TRAINING_DATA`: Training transitions targeting semesters $< t$ are fewer than `minTrainingSamples` (e.g. target semester 2, where 0 earlier transitions exist).
- `FIT_FAILED`: Model fitting threw an error (e.g. constant predictor variance $< 10^{-12}$); failure reason recorded explicitly.
- `SKIPPED_NO_TEST_DATA`: No valid transitions targeting semester $t$ exist.
- **No Silent Substitution**: Persistence predictions are never labeled as regression predictions. Failed folds are reported explicitly.

---

### 5.5 Analytical Dashboard & Distribution Engine (`js/core/dashboard_analytics.js`)

Implements pure mathematical algorithms for cohort summaries, empirical distributions, transition matrices, residual analyses, and deterministic outlier review candidates.

#### 1. Quantile & Percentile Convention:
To calculate empirical percentiles on a sorted sample $x_0 \le x_1 \le \dots \le x_{n-1}$, ClassPredict adopts the standard continuous sample quantile convention (R Type 7, Excel `PERCENTILE.INC`, NumPy default):

$$\text{index} = p \times (n - 1),\qquad i = \lfloor \text{index} \rfloor,\qquad f = \text{index} - i$$

$$Q(p) = x_i + f \cdot (x_{i+1} - x_i)$$

* First Quartile: $Q_1 = Q(0.25)$
* Median: $\text{Median} = Q(0.50)$
* Third Quartile: $Q_3 = Q(0.75)$
* Interquartile Range: $\text{IQR} = Q_3 - Q_1$

#### 2. Histogram Binning Convention:
For the default GPA scale $[0.00, 4.00]$, the distribution is partitioned into 8 uniform bins of width $w = 0.50$:
$$B_k = [k \cdot w, (k + 1) \cdot w) \quad \text{for } k = 0, \dots, 6;\qquad B_7 = [3.50, 4.00]$$
* **Boundary Rule**: Values falling exactly on a bin boundary are placed in the bin for which that value is the lower bound, except for the maximum boundary ($4.00$) which is included in the highest bin $B_7$.

#### 3. Tukey Boxplot Whiskers & Outliers:
* **Lower Fence**: $L_{\text{fence}} = Q_1 - 1.5 \times \text{IQR}$
* **Upper Fence**: $U_{\text{fence}} = Q_3 + 1.5 \times \text{IQR}$
* **Lower Whisker**: Lowest observed datum $x_i \ge L_{\text{fence}}$
* **Upper Whisker**: Highest observed datum $x_i \le U_{\text{fence}}$
* **Outliers**: Observations where $x_i < \text{Lower Whisker}$ or $x_i > \text{Upper Whisker}$. Flagged for auditor inspection as review candidates.

#### 4. In-Sample Residuals:
For each valid consecutive transition $(x_i, y_i) = (s_t, s_{t+1})$:
$$e_i = y_i - \hat{y}_i = y_i - (a + b\,x_i)$$
* **Mathematical Property**: When linear regression is fitted with an intercept via centered Normal Equations, the sum (and mean) of in-sample residuals is mathematically zero within machine precision:
  $$\sum_{i=1}^n e_i = \sum_{i=1}^n (y_i - \bar{y} - b(x_i - \bar{x})) = 0$$
* **Distinction**: In-sample residuals describe historical training fit, not forward-looking predictive generalization. Out-of-sample prediction errors are computed strictly via rolling-origin temporal evaluation (Section 5.4).

#### 5. Transition Summary Matrix:
A $K \times K$ matrix $T$ where entry $T_{r, c}$ counts students possessing valid observations for both semester $r$ and semester $c$:
* **Consecutive Transitions**: $c = r + 1$. Evaluated and eligible for regression training.
* **Non-Consecutive Gaps**: $c - r > 1$. Counted as $0$ and flagged `GAP_SKIPPED` under non-bridging rules.

#### 6. Deterministic 1.5x IQR Review Candidate Rule:
* **Semester Distribution**: Flags students in semester $t$ ($n \ge 4$) whose SGPA falls outside $[Q_1 - 1.5 \times \text{IQR}, Q_3 + 1.5 \times \text{IQR}]$.
* **Transition Residuals**: Flags transitions ($n \ge 4$) whose in-sample residual satisfies $|e_i - \text{Median}(e)| > 1.5 \times \text{IQR}(e)$.
* **Ethical Guardrail**: Flagged points are strictly review candidates for transcription verification. ClassPredict never modifies, deletes, or excludes observations automatically.

---

### 5.6 Numerical Methods Educational Laboratory Engine (`js/core/numerical_lab.js`)

Implements interactive mathematical experiments directly aligned with the undergraduate CSE Numerical Methods curriculum.

#### 1. Gaussian Elimination Trace & Operation Accounting (Experiment A):
* **Forward Elimination Multiplier**:
  $$m_{ik} = \frac{a_{ik}^{(k)}}{a_{kk}^{(k)}}$$
* **Elementary Row Operation**:
  $$R_i \leftarrow R_i - m_{ik} R_k$$
* **Row Partial Pivoting**:
  In each column $k$, select pivot row $p \ge k$ such that:
  $$|a_{pk}^{(k)}| = \max_{i \ge k} |a_{ik}^{(k)}|$$
  Swapping rows $p$ and $k$ ensures that all row multipliers satisfy $|m_{ik}| \le 1$, strictly bounding round-off amplification.
* **Scale-Aware Singularity Guard**:
  A pivot is accepted if and only if $|a_{pk}^{(k)}| \ge 10^{-14} \cdot \max_{i,j \ge k} |a_{ij}^{(k)}|$.
* **Back Substitution**:
  $$x_{n-1} = \frac{b_{n-1}}{a_{n-1, n-1}}, \qquad x_i = \frac{b_i - \sum_{j=i+1}^{n-1} a_{ij} x_j}{a_{ii}} \quad (i = n-2, \dots, 0)$$
* **Residual Vector & Norm**:
  $$\mathbf{r} = \mathbf{b} - A\hat{\mathbf{x}}, \qquad \|\mathbf{r}\|_2 = \sqrt{\sum_{i=1}^n r_i^2}$$

#### 2. Linear vs. Quadratic Regression & Normal Equations (Experiment B):
* **First-Order Linear Model**: $y = a_0 + a_1 x$
* **Second-Order Quadratic Model**: $y = a_0 + a_1 x + a_2 x^2$
* **Condition Squaring of Normal Equations**:
  For design matrix $X$, the Normal Equations $(X^T X)\mathbf{\beta} = X^T \mathbf{y}$ square the 2-norm condition number:
  $$\kappa_2(X^T X) = (\kappa_2(X))^2$$
  For quadratic models, $x^4$ creates huge dynamic range across matrix entries, severely worsening conditioning.
* **Predictor Centering Strategy for Quadratic Fit**:
  Using centered coordinates $x' = x - \bar{x}$, the model is reparameterized as:
  $$y = c_0 + c_1 x' + c_2 (x')^2$$
  Because $\sum x' = 0$, the $(0, 1)$ and $(1, 0)$ off-diagonal entries in $X'^T X'$ are identically zero:
  $$\begin{bmatrix} n & 0 & \sum (x'_i)^2 \\ 0 & \sum (x'_i)^2 & \sum (x'_i)^3 \\ \sum (x'_i)^2 & \sum (x'_i)^3 & \sum (x'_i)^4 \end{bmatrix} \begin{bmatrix} c_0 \\ c_1 \\ c_2 \end{bmatrix} = \begin{bmatrix} \sum y_i \\ \sum x'_i y_i \\ \sum (x'_i)^2 y_i \end{bmatrix}$$
  Solved via Gaussian elimination with scale-aware row partial pivoting.
* **Algebraic Coordinate Recovery to Original Scale**:
  $$a_2 = c_2, \qquad a_1 = c_1 - 2 c_2 \bar{x}, \qquad a_0 = c_0 - c_1 \bar{x} + c_2 \bar{x}^2$$
* **Residual Sum of Squares (RSS)**:
  $$\text{RSS} = \sum_{i=1}^n (y_i - \hat{y}_i)^2$$
* **Academic Takeaway**: While $\text{RSS}_{\text{quad}} \le \text{RSS}_{\text{lin}}$ by mathematical construction due to parameter flexibility (3 parameters vs. 2), lower in-sample RSS does not establish better future predictive generalization. High-degree polynomials overfit sample noise.

#### 3. Newton Divided-Difference Polynomial Interpolation (Experiment C):
* **Divided-Difference Recurrence Table**:
  $$f[x_i] = y_i, \qquad f[x_i, \dots, x_{i+k}] = \frac{f[x_{i+1}, \dots, x_{i+k}] - f[x_i, \dots, x_{i+k-1}]}{x_{i+k} - x_i}$$
* **Newton Form**:
  $$P_n(x) = f[x_0] + \sum_{k=1}^n f[x_0, \dots, x_k] \prod_{j=0}^{k-1} (x - x_j)$$
* **Horner's Nested Evaluation Scheme**:
  $$P_n(x) = c_0 + (x - x_0)(c_1 + (x - x_1)(c_2 + \dots + (x - x_{n-1}) c_n)\dots)$$
* **Extrapolation Boundary Policy**:
  Interpolation is strictly valid within the convex hull $[x_{\min}, x_{\max}]$. Evaluating outside this interval triggers an explicit `EXTRAPOLATION` warning indicating rapid polynomial divergence.

#### 4. Runge Phenomenon & Node Distribution (Experiment D):
* **Deterministic Test Function**:
  $$f(x) = \frac{1}{1 + 25 x^2}, \qquad x \in [-1, 1]$$
* **Equally Spaced Nodes**: $x_j = -1 + \frac{2j}{n-1}$. For $n \ge 9$, interpolation error grows exponentially near the boundaries $x \approx \pm 1$ despite exact interpolation at all nodes.
* **Chebyshev Node Distribution**:
  $$x_j = -\cos\left(\frac{2j + 1}{2n} \pi\right), \quad j = 0, \dots, n-1$$
  Clustering node density near endpoints minimizes Lebesgue constants, suppressing Runge oscillations.
* **Error Metrics Over Uniform 101-Point Grid**:
  $$\text{Max Absolute Error} = \max_{k} |f(t_k) - P_n(t_k)|, \qquad \text{RMSE} = \sqrt{\frac{1}{101} \sum_{k=0}^{100} (f(t_k) - P_n(t_k))^2}$$
* **Core Curriculum Principle**: Explains why ClassPredict strictly uses low-order least squares (Model B, Model C) for academic forecasting rather than high-degree polynomial interpolation.


