# UI/UX Design Specification — ClassPredict

> **Document ID**: DOC-UI-001  
> **Status**: Approved & Implemented (Phase 9 Verified)  
> **Lifecycle State**: Implemented & Tested  
> **Last Updated**: October 2026  
> **Visual Direction**: Obsidian Black & Deep Crimson Dark Theme

---

## 1. Visual Design Philosophy & Aesthetic Identity

ClassPredict's interface is crafted to balance **academic precision** with **portfolio-grade visual excellence**. The aesthetic rejects generic bootstrap templates and blinding light themes in favor of an **Obsidian & Deep Crimson** dark design system.

Key aesthetic principles:
1. **Academic Clarity Over Decoration**: Visual hierarchy directs the evaluator's eye to numerical metrics, sample sizes, and model parameters without visual clutter.
2. **Restrained Color Accents**: Deep crimson (`#DC2626`) provides focused focal points for primary actions and active navigation, while restrained amber (`#F59E0B`) highlights warnings without causing alarm.
3. **Data-Dense Yet Breathable**: Polished tables and analytical cards utilize subtle border glows (`rgba(220, 38, 38, 0.18)`) and balanced padding (16–24px) to ensure high readability.
4. **Honest Indicators**: Synthetic demonstration datasets are badged with a distinctive blue-slate indicator (`SYNTHETIC DEMO DATA`), preventing any misleading implication of verified real-world student counts.

---

## 2. Design Tokens & Color Palette

```
Surface (Obsidian)     Card Surface (Charcoal)  Primary Accent (Crimson) Warning Accent (Amber)
#0B0B0E                #14141A                  #DC2626                  #F59E0B
[████████████████]     [████████████████]       [████████████████]       [████████████████]
```

### 2.1 CSS Color Token Specification

```css
:root {
  /* Surfaces & Backgrounds */
  --bg-primary: #0B0B0E;         /* Deep Obsidian Black */
  --bg-card: #14141A;            /* Charcoal Elevation */
  --bg-card-hover: #1A1A22;      /* Interactive Hover */
  --bg-input: #0E0E14;           /* Form Field Background */
  --bg-overlay: rgba(11, 11, 14, 0.85); /* Modal Backdrop */

  /* Borders & Dividers */
  --border-subtle: #242430;      /* Structural Divider */
  --border-focus: #DC2626;       /* Focused Form Outline */
  --border-card-glow: rgba(220, 38, 38, 0.18); /* Card Accent Glow */

  /* Brand & Semantic Accents */
  --accent-primary: #DC2626;     /* Deep Crimson / Brand Red */
  --accent-primary-hover: #EF4444;/* Lighter Red on Hover */
  --accent-secondary: #991B1B;   /* Dark Burgundy Border/Pill */
  --accent-warning: #F59E0B;     /* Amber (Out of bounds / Low confidence) */
  --accent-success: #10B981;     /* Emerald (Validated / Beat baseline) */
  --accent-info: #3B82F6;        /* Cobalt (Synthetic data flag) */

  /* Typography */
  --text-primary: #F8FAFC;       /* High Contrast White */
  --text-secondary: #94A3B8;     /* Muted Slate Grey */
  --text-tertiary: #64748B;      /* Dimmed Metadata */
  --text-code: #F43F5E;          /* Inline Code / Formula Highlight */

  /* Typography Fonts */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
}
```

---

## 3. Presentation of Mathematical Predictions (Out-of-Bounds Policy)

A core requirement of academic honesty is that the user interface **must never conceal mathematical model behavior**:

### 3.1 Primary Raw Prediction Display
* The primary metric rendered on the prediction card is **always the raw mathematical output** (e.g., `4.18 SGPA` or `-0.15 SGPA`).
* It must never be silently clipped or rounded to fit the grading scale.

### 3.2 Out-of-Bounds Warning Badge
* When raw prediction $\hat{s} \notin [0.00, 4.00]$, an amber warning badge appears directly below the number:
  ```html
  <div class="badge-warning">
    ⚠️ Raw mathematical prediction (4.18) exceeds grading scale [0.00, 4.00]
  </div>
  ```

### 3.3 Separately Labeled Bounded Reference
* If an institutional comparison is needed, a secondary field may be displayed, explicitly labeled:
  - **Bounded Domain Reference**: `4.00`
  - **Explanatory Footnote**: *"Note: Strictly bounded to the maximum institutional scale for reference. The regression model produced an unclamped output of 4.18."*

---

## 4. Degree-of-Freedom Statistical Warning Cards

For individual predictions (Model C, $s_k = a + b\,k$), the UI renders statistical confidence badges grounded in residual degrees of freedom ($\nu = K - 2$):

* **$K = 3$ Semesters ($\nu = 1$)**: Amber-Red Alert Card:
  `⚠️ Extreme Statistical Volatility: Only 1 degree of freedom (t_crit = 12.71). Trend slope is sensitive to minor noise.`
* **$K = 4$ Semesters ($\nu = 2$)**: Amber Alert Card:
  `⚠️ High Statistical Volatility: 2 degrees of freedom (t_crit = 4.30). Uncertainty interval is wide.`
* **$K \ge 5$ Semesters ($\nu \ge 3$)**: Slate Informational Card:
  `ℹ️ Adequate Historical Horizon: Standard linear trend parameters stabilized.`

---

## 5. Application Layout & Navigation Architecture

```
+---------------------------------------------------------------------------------------------------------+
|  [CP] ClassPredict  |  Dashboard  |  Dataset Ingestion  |  Predictions  |  OCR Import  |  Numerical Lab | [Scale: 4.00]
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  [Active View Container: Responsive Grid 12-Columns]                                                   |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
|  ClassPredict v1.0 • Academic Numerical Methods Capstone • Ephemeral Session                            |
+---------------------------------------------------------------------------------------------------------+
```

### 5.1 Navigation Tabs
1. **Dashboard (`#tab-dashboard`)**: Analytical overview hosting 5 sub-tabs:
   - **Transitions & Regression (`transitions`)**: SVG Scatter plot ($s_t$ vs $s_{t+1}$), fitted regression line, persistence baseline ($y = x$), point hover tooltips, accessible tabular toggle, and in-sample residual plot ($e_i = y_i - \hat{y}_i$).
   - **Semester Distributions (`distributions`)**: Semester selector pills, 8-bin frequency histogram over $[0.00, 4.00]$, Tukey boxplot with whiskers and highlighted outliers, and descriptive statistics.
   - **Temporal Evaluation (`evaluation`)**: Paired holdout MAE and RMSE comparison cards, side-by-side error bars, and chronological fold breakdown table.
   - **Transition Matrix (`matrix`)**: $K \times K$ transition availability table showing 1-step counts and non-consecutive gap exclusions.
   - **Review Candidates (`candidates`)**: Deterministic 1.5x IQR outlier candidates table with pseudonymous keys, bounds, and ethical auditor guidance.
2. **Dataset Ingestion (`#tab-dataset`)**: Manual CSV drag-and-drop dropzone, schema guidance, staged dataset confirmation, and raw records inspection.
3. **Predictions (`#tab-predictions`)**: Dual-pane forecasting view (Individual Student Trend & Whole-Class Cohort Prediction) with RFC-4180 CSV export.
4. **OCR Ingestion (`#tab-ocr`)**: Mark sheet upload, page selector, canvas rectangular cropping boundary, and editable review table with key reconciliation.
5. **Numerical Lab (`#tab-lab`)**: Interactive educational sandbox hosting 5 sub-tabs:
   - **Experiment A: Gaussian Elimination (`exp-a`)**: Step-by-step augmented matrix $[A | \mathbf{b}]$ reduction, pivot selection, row swap highlights, multiplier display $m_{ik} = a_{ik}/a_{kk}$, row operation formulas, back-substitution stepping, and residual norm $\|\mathbf{r}\|_2$.
   - **Experiment B: Linear vs. Quadratic Regression (`exp-b`)**: Simultaneous curve fitting comparison, centered normal equations $(X'^T X')\mathbf{c} = X'^T \mathbf{y}$, condition squaring demonstration, in-sample RSS improvement vs. out-of-sample overfitting risk, and accessible data table toggle.
   - **Experiment C: Newton Divided Differences (`exp-c`)**: Interactive divided-difference recurrence triangle table, Horner's nested polynomial construction, term-by-term running sums, SVG domain hull, and extrapolation warning flags.
   - **Experiment D: Runge Phenomenon & Risk (`exp-d`)**: Simulation on $f(x) = 1/(1+25x^2)$, comparison of equally spaced vs. Chebyshev node distributions, 101-point evaluation grid, edge oscillation metrics, and academic rationale for low-order least squares.
   - **Numerical Stability Topics (`topics`)**: Educational cards covering round-off vs. truncation, residual vs. solution error, normal equations conditioning, and interpolation vs. regression.

---

## 6. Portfolio Screenshot Sequence & Storyboard Plan

For the Fiverr portfolio and final university viva presentation, ClassPredict plans a 6-screenshot sequence:

1. **Cover / Hero Shot**: High-angle perspective mockup of the Obsidian/Crimson dashboard with loaded cohort distributions, linear model equation banner, and empirical MAE metrics.
2. **Main Dashboard**: Full-resolution capture of cohort distributions, semester transitions histogram, and live model comparison metrics.
3. **Individual SGPA Prediction View**: Step-by-step student trajectory input (4 semesters completed), fitted regression line, predicted point $\hat{s}_5$, and $95\%$ uncertainty interval.
4. **Whole-Class Batch Prediction**: Dense, polished data table showing students with sorting, color-coded trajectory arrows, and insufficient data flags.
5. **Privacy-Preserving OCR Ingestion**: Canvas crop box isolating the SGPA column on a university gradesheet, paired with the editable review table and key reconciliation selector.
6. **Numerical Methods Educational Laboratory**: Side-by-side comparison of Newton Divided-Difference Interpolation versus Linear Least Squares, illustrating Runge's phenomenon during extrapolation.
