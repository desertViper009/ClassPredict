# ADR-002: Numerical Modeling & Algorithm Strategy

> **Status**: Accepted (Amended with Mandatory Corrections)  
> **Date**: October 2026  
> **Scope**: Numerical Computation, Solvers & Conditioning Strategy

---

## 1. Context

In a university Numerical Methods project, algorithmic decisions must be mathematically justified and defensible. Cohort transition datasets (40–80 students) yield between 80 and 480 transition pairs. High-capacity models (neural networks, high-degree polynomials) suffer severe variance and overfit on small samples.

The project requires:
1. A rigorous null hypothesis benchmark (Persistence Baseline).
2. A parsimonious cohort transition model (Linear Least Squares).
3. An individual trajectory model with degrees-of-freedom warnings.
4. An educational demonstration of system conditioning, row partial pivoting, and the dangers of extrapolating polynomial interpolants.
5. A scale-aware singularity detection strategy replacing fixed determinant thresholds.

---

## 2. Alternatives Considered

* **Fixed Determinant Threshold ($\det < 10^{-7}$)**: Rejected. Determinant magnitude is scale- and dimension-dependent ($\det(c A) = c^n \det(A)$). A well-conditioned matrix with small entries can have a tiny determinant, while an ill-conditioned matrix with large entries can have a large determinant.
* **Complex Non-Linear Models (Splines, Neural Networks, Random Forests)**: Rejected. Over-parameterized for small transition datasets; uninterpretable black boxes in viva defense.
* **QR Factorization vs. Normal Equations**:
  - QR decomposition via Householder reflections avoids squaring the condition number ($\kappa_2(R) = \kappa_2(X)$).
  - Normal Equations $(X^T X)\mathbf{\beta} = X^T \mathbf{y}$ squares the condition number, but when combined with predictor centering ($x - \bar{x}$), the system becomes decoupled and orthogonal. For $2 \times 2$ and $3 \times 3$ systems, it directly illustrates syllabus topics: Normal Equations, Gaussian Elimination, and row partial pivoting.

---

## 3. Decision

1. **Establish the Persistence Baseline (Model A)**: $\hat{s}_{t+1} = s_t$. Candidate models must demonstrate lower MAE and RMSE than Model A on temporal holdouts.
2. **Implement Multi-Stage Singularity & Conditioning Strategy**:
   - **Variance Pre-check**: Verify $\text{Var}(x) \ge 10^{-12}$; if zero variance, rank is deficient ($\text{rank}(X) = 1$), and fallback to Model A is triggered.
   - **Predictor Centering**: Center predictors $x' = x - \bar{x}$ to eliminate off-diagonal covariance in $X^T X$, reducing condition number.
   - **Scale-Aware Pivot Tolerance in Gaussian Elimination**: Reject pivots satisfying $|a_{pk}^{(k)}| < 10^{-14} \cdot \max_{i,j \ge k}|a_{ij}^{(k)}|$ rather than checking absolute values.
   - **Non-Finite Arithmetic Guard**: Abort if any intermediate computation evaluates to `NaN` or `±Infinity`.
   - **Academic Honesty on Partial Pivoting**: Document that row partial pivoting prevents divide-by-zero and error magnification in well-scaled matrices, but cannot resolve intrinsic ill-conditioning.
3. **Explicit Conditions for Baseline Fallback**: Fallback to Persistence Baseline occurs strictly when:
   - Input transition variance $< 10^{-12}$, or
   - Scale-aware pivot tolerance is violated, or
   - Non-finite arithmetic is encountered, or
   - Consecutive transitions $M < 2$.
4. **Statistical Warning Policy for Model C**: Warning thresholds are grounded in residual degrees of freedom $\nu = K - 2$:
   - $K \le 2$: Prohibited (insufficient degrees of freedom).
   - $K = 3$ ($\nu = 1, t = 12.7$): Extreme volatility warning.
   - $K = 4$ ($\nu = 2, t = 4.3$): High volatility warning.
   - $K \ge 5$ ($\nu \ge 3$): Moderate to adequate sample horizon.
5. **Raw Out-of-Range Display Policy**: Never silently clip predictions. Always display raw mathematical output with an explicit out-of-bounds warning badge if $\hat{s} \notin [0.00, 4.00]$. Any bounded value must be separately labeled as a reference.

---

## 4. Consequences & Trade-offs

* **Positive**: 100% mathematically defensible under viva examination; eliminates fragile fixed determinant thresholds; honest error reporting.
* **Negative**: Requires careful matrix scale calculations during Gaussian elimination forward elimination.
