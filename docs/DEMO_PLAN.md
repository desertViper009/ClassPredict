# Demonstration & Defense Plan — ClassPredict

> **Document ID**: DOC-DEMO-001  
> **Status**: Approved & Verified (Phase 10 Production Release & Portfolio Demonstration Ready)  
> **Lifecycle State**: Deployed & Verified  
> **Last Updated**: October 2026  
> **Target Audience**: Student Presenter, University Viva Examiners, Portfolio Reviewers

---

## 1. Demonstration Goals & Objectives

This document outlines a structured, 10-minute presentation script and oral examination defense strategy for the undergraduate **Numerical Methods** final project evaluation.

The demonstration is designed to prove:
1. **Mathematical Mastery**: Command over Normal Equations, predictor centering, Gaussian Elimination with scale-aware row partial pivoting, condition number analysis, and divided differences.
2. **Methodological Honesty**: Transparent evaluation against the Persistence Baseline, raw mathematical output display without silent clipping, and explicit presentation of degrees of freedom.
3. **Engineering Integrity**: Client-side privacy architecture, responsive dark UI design, and robust handling of numerical edge cases.

---

## 2. 10-Minute Viva Presentation Script

```
[0:00 - 1:30] Introduction & Problem Formulation
      │
[1:30 - 3:30] Dashboard & Ingestion: Parsing & Validation Integrity
      │
[3:30 - 5:30] Numerical Forecasting: Single Student & Whole-Class Batch
      │
[5:30 - 7:30] Privacy-First OCR: Crop Isolation & Key Reconciliation Barrier
      │
[7:30 - 9:00] Numerical Methods Lab: Centering, Scale-Aware Solvers & Interpolation vs Extrapolation
      │
[9:00 - 10:00] Evaluation Honesty, Limitations & Viva Q&A
```

---

### Step 1: Opening & Problem Formulation (1.5 Minutes)
* **Action**: Display the Obsidian/Crimson dashboard with the synthetic demo dataset loaded.
* **Speaker Script**:
  > *"Good morning, respected examiners. Today I present ClassPredict, a web-based academic performance analysis and next-semester SGPA prediction software built as our Numerical Methods final project.*  
  > *In academic forecasting, datasets are inherently small—a typical class cohort has 40 to 80 students over 3 to 7 semesters. Complex deep learning models catastrophically overfit on such small sample sizes. We engineered ClassPredict to demonstrate that classical numerical methods—specifically linear least-squares regression with predictor centering, Gaussian elimination with scale-aware partial pivoting, and rolling-origin temporal validation—provide transparent, defensible, and reliable academic forecasts while maintaining 100% data privacy."*

---

### Step 2: Ingestion & Validation Integrity (2 Minutes)
* **Action**: Demonstrate uploading a malformed CSV with an out-of-scale SGPA (e.g., `4.85`) and a duplicate semester entry.
* **Speaker Script**:
  > *"Before any mathematical modeling occurs, data integrity is strictly enforced. Notice when I upload this test CSV, the system catches an invalid SGPA of 4.85 on row 8 and a duplicate record on row 14, refusing to corrupt our numerical system.*  
  > *When I load our verified benchmark dataset, the dashboard instantly visualizes cohort SGPA distributions and consecutive-semester transition pairs.*  
  > *Crucially, note the prominent badge: 'SYNTHETIC DEMO DATA'. As an academic standard, we never fabricate student statistics or imply that synthetic test numbers represent real institutional findings."*

---

### Step 3: Numerical Forecasting in Action (2 Minutes)
* **Action**: Navigate to **Predictions $\to$ Individual Predictor**. Enter student history: $[3.10, 3.25, 3.40, 3.55]$.
* **Speaker Script**:
  > *"Here, we evaluate a student with 4 completed semesters. The system estimates the Semester 5 SGPA.*  
  > *We provide three models: Model B (Class-Wide Linear Transition), Model C (Individual Least-Squares Trend), and Model A (our Persistence Baseline).*  
  > *Notice that for this student, Model B predicts an SGPA of 3.62 with a 95% uncertainty interval.*  
  > *Now, observe what happens if we input an extreme trajectory where mathematical extrapolation predicts 4.15: ClassPredict never silently clips the result to 4.00. It displays the raw mathematical calculation alongside an explicit out-of-bounds warning badge, preserving mathematical transparency. If an institutional bound is desired, it is separately labeled as a 'Bounded Domain Reference'."*

---

### Step 4: Privacy-Preserving OCR & Key Reconciliation (2 Minutes)
* **Action**: Switch to the **OCR Import** tab. Upload a sample university marksheet PDF. Drag the crop box over *only* the SGPA column.
* **Speaker Script**:
  > *"University result sheets contain sensitive personal data: student names, registration numbers, and photo IDs. ClassPredict addresses this through Privacy-by-Design.*  
  > *Notice that rather than sending the document to an external cloud API, our client-side canvas allows me to crop strictly around the SGPA column. Only this cropped sub-bitmap is passed to our local in-browser Tesseract Web Worker. The student's name and registration number never touch the OCR parser.*  
  > *Furthermore, look at our Human-in-the-Loop review table: student identity is never assumed from row position across separate sheets. The user explicitly reconciles candidate grades to stable pseudonymous keys. No unverified OCR record ever enters our training dataset until confirmed."*

---

### Step 5: The Numerical Methods Laboratory (1.5 Minutes)
* **Action**: Open the **Numerical Lab** tab. Select the comparison between Linear Least Squares and Newton Divided-Difference Polynomial Interpolation.
* **Speaker Script**:
  > *"To directly demonstrate our course syllabus, we built the Numerical Methods Lab.*  
  > *Here, examiners can inspect the Normal Equations matrix $(X^T X)$ and observe row partial pivoting in action. Notice that we do not rely on an arbitrary fixed determinant threshold: we pre-check input variance (Var < 1e-12) and employ a scale-aware relative pivot tolerance (tau = 1e-14 * submatrix_max). If the system is rank-deficient, it safely falls back to baseline.*  
  > *Furthermore, we demonstrate the vital distinction between interpolation and extrapolation: while Newton's divided-difference polynomial matches historical data points with zero residual error, extrapolating forward into the next semester leads to Runge-type polynomial oscillation and absurd values like 6.50. This visually proves why least-squares curve fitting is the mathematically correct choice for forecasting."*

---

### Step 6: Evaluation Honesty & Conclusion (1 Minute)
* **Action**: Show the **Rolling-Origin Temporal Evaluation** card on the dashboard.
* **Speaker Script**:
  > *"Finally, we evaluated our models using rolling-origin temporal validation across semesters, completely preventing future-to-past data leakage. Across our validation folds, Model B is benchmarked against the Persistence Baseline.*  
  > *Thank you. I am now ready for your questions."*

---

## 3. Anticipated Viva Defense Q&A

### Question 1: "Why can't you just check if det(A) < 1e-7 to detect singularity?"
* **Answer**:  
  > *"Because determinant magnitude is scale-dependent and dimension-dependent: det(c A) = c^n det(A). If we scale a 2x2 matrix by 0.0001, its determinant scales by 1e-8, falling below 1e-7 even though its condition number is unchanged and the matrix is perfectly well-conditioned! Instead of a fixed determinant threshold, ClassPredict checks input sample variance (Var(x) < 1e-12) to detect collinearity and uses a scale-aware relative pivot tolerance (|pivot| < 1e-14 * submatrix_max) during Gaussian elimination."*

### Question 2: "Does Gaussian elimination with partial pivoting solve all conditioning problems?"
* **Answer**:  
  > *"No. Row partial pivoting guarantees that multipliers satisfy |m_ik| <= 1, strictly bounding round-off error growth in well-scaled matrices. However, partial pivoting cannot cure an inherently ill-conditioned system whose condition number is close to machine epsilon. In ClassPredict, we also center our predictors (x - mean(x)) to eliminate off-diagonal covariance in the Normal Equations, directly reducing the condition number."*

### Question 3: "Why not use high-degree polynomial interpolation to forecast the next grade?"
* **Answer**:  
  > *"Interpolation guarantees that the polynomial passes through all historical data points, but polynomial extrapolation outside the convex hull of the data is inherently unstable due to Runge's phenomenon. Small disturbances in historical grades cause massive oscillations at x = K+1. Least-squares regression minimizes the global variance without forcing the curve through noisy individual points."*

### Question 4: "Why did you forbid random k-fold cross-validation?"
* **Answer**:  
  > *"Random k-fold CV destroys chronological causality. If we train on Semester 4 transitions and test on Semester 2, future grading distributions leak into past predictions. We implemented expanding-window rolling-origin temporal backtesting: we fit strictly on transitions up to semester T-1 and evaluate predictions on semester T."*

### Question 5: "How does your system handle student identity across multiple semester sheets?"
* **Answer**:  
  > *"We enforce that students maintain a stable pseudonymous key across semesters, and we strictly forbid inferring student identity from OCR row position because student cohort ordering changes between semesters. When importing a new semester sheet, the user must explicitly reconcile extracted grades with existing pseudonymous keys in an editable review table."*
