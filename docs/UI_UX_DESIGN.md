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
Near-Black Background    Surface Panel           Elevated Surface        Primary Crimson Accent  Coral Accent
#090A0D                  #101217                 #171A21                 #FF3038                 #FF7857
[████████████████]       [████████████████]      [████████████████]      [████████████████]      [████████████████]
```

### 2.1 CSS Color Token Specification

```css
:root {
  /* Core Modern Dark SaaS Palette */
  --color-bg: #090a0d;            /* Cinematic Charcoal Canvas */
  --color-surface: #101217;       /* Card & Main Panel Surface */
  --color-surface-raised: #171a21;/* Hover / Elevated Container */
  --color-border: #232732;        /* Subtle Border Divider */
  --color-border-subtle: #1c202a; /* Card Internal Divider */
  --color-primary: #ff3038;       /* Vivid Crimson Brand Accent */
  --color-primary-hover: #ff5057; /* Hover State for Crimson Accent */
  --color-accent: #ff7857;        /* Warm Coral Secondary Accent */
  --color-text: #f5f5f7;          /* Warm High-Contrast White */
  --color-muted: #a0a4ae;         /* Slate Secondary Muted Text */
  --color-subtle: #6b7280;        /* Dimmed Metadata Text */
  --color-success: #35c98a;       /* Emerald Success State */
  --color-warning: #ffb454;       /* Amber Warning & Out-of-Bounds */
  --color-danger: #ff525b;        /* Error & Danger Badge */

  /* Backwards-Compatible Legacy Aliases */
  --bg-primary: var(--color-bg);
  --bg-card: var(--color-surface);
  --bg-card-hover: var(--color-surface-raised);
  --bg-input: #0c0e12;
  --bg-overlay: rgba(9, 10, 13, 0.85);
  --border-subtle: var(--color-border);
  --border-focus: var(--color-primary);
  --border-card-glow: rgba(255, 48, 56, 0.16);
  --accent-primary: var(--color-primary);
  --accent-primary-hover: var(--color-primary-hover);
  --accent-secondary: var(--color-accent);
  --accent-warning: var(--color-warning);
  --accent-success: var(--color-success);
  --accent-info: #60a5fa;
  --text-primary: var(--color-text);
  --text-secondary: var(--color-muted);
  --text-tertiary: var(--color-subtle);
  --text-code: #ff7857;

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
| [CP] ClassPredict | Top Control Bar: [Breadcrumb] | [Demo] [Scale: 4.00] [Status: Online]              |
+-------------------+-------------------------------------------------------------------------------------+
| PERSISTENT SIDEBAR| MAIN CONTENT CANVAS                                                                 |
|                   |                                                                                     |
| [📊 Overview]     | Page Title & Subtitle                                                               |
| [📥 Dataset Mgmt] | Dynamic KPI Metrics Grid (Cards with hover glow & tabular figures)                  |
| [⚡ Predictions]  | Interactive Charts / Forms / Stepper / Matrix Visualizers                           |
| [📷 OCR Review]   | Secondary Tabular & Diagnostic Data Panels                                          |
| [🔬 Numerical Lab]|                                                                                     |
|                   |                                                                                     |
| [Dataset Widget]  |                                                                                     |
| [Privacy Badge]   |                                                                                     |
+-------------------+-------------------------------------------------------------------------------------+
| ClassPredict v1.1.0 • Academic Numerical Methods Capstone • Ephemeral Client-Side Session               |
+---------------------------------------------------------------------------------------------------------+
```

### 5.1 Shell Components
1. **Persistent Left Sidebar (`.app-sidebar`)**:
   - ClassPredict Logo and Wordmark with crimson badge.
   - Core Navigation: Overview (`#tab-btn-dashboard`), Dataset Management (`#tab-btn-dataset`), Predictions (`#tab-btn-predictions`), OCR Review (`#tab-btn-ocr`), and Numerical Methods Lab (`#tab-btn-lab`).
   - Active state styling: Left crimson accent border (`3px solid var(--color-primary)`), elevated background (`var(--color-surface-raised)`), and warm white text.
   - Dynamic session dataset status widget (`#sidebar-dataset-widget`) displaying real-time record count and active semester range.
   - Compact client-side privacy indicator.
2. **Top Control Bar (`.topbar`)**:
   - Mobile hamburger drawer toggle (`#sidebar-toggle-btn`) with responsive breakpoint visibility (`<= 1024px`).
   - Dynamic view breadcrumb title (`#page-breadcrumb-title`).
   - Synthetic demonstration dataset loader button (`#btn-header-demo`).
   - Standard academic grading scale indicator tag (`0.00 – 4.00 SGPA`).
   - Network status badge (`#net-status-badge`) indicating `Online` or `Offline Shell`.
3. **Mobile Drawer Navigation (`<= 1024px`)**:
   - Slides from left on drawer toggle with smooth cubic-bezier transition.
   - Backdrop overlay (`#sidebar-backdrop`) with tap-to-dismiss behavior.
   - Automatic collapse upon navigation selection.
   - Responsive Reflow: Single-column KPI reflow at `<= 768px`, horizontally scrolling data tables with sticky headers, touch-friendly form inputs, and zero horizontal page overflow.

### 5.2 Navigation Views
1. **Dashboard (`#tab-btn-dashboard`)**: Analytical overview hosting 5 sub-tabs:
   - **Transitions & Regression (`transitions`)**: SVG Scatter plot ($s_t$ vs $s_{t+1}$), fitted regression line, persistence baseline ($y = x$), point hover tooltips, accessible tabular toggle, in-sample residual plot ($e_i = y_i - \hat{y}_i$), and real-time next-semester prediction preview card with deep link to prediction workspace.
   - **Semester Distributions (`distributions`)**: Semester selector pills, 8-bin frequency histogram over $[0.00, 4.00]$, Tukey boxplot with whiskers and highlighted outliers, and descriptive statistics.
   - **Temporal Evaluation (`evaluation`)**: Paired holdout MAE and RMSE comparison cards, side-by-side error bars, and chronological fold breakdown table.
   - **Transition Matrix (`matrix`)**: $K \times K$ transition availability table showing 1-step counts and non-consecutive gap exclusions.
   - **Review Candidates (`candidates`)**: Deterministic 1.5x IQR outlier candidates table with pseudonymous keys, bounds, and ethical auditor guidance.
2. **Dataset Management (`#tab-btn-dataset`)**: Manual CSV drag-and-drop dropzone with dragover highlighting, schema guidance banner, staged dataset confirmation, live validation diagnostics, and raw records inspection.
3. **Predictions (`#tab-btn-predictions`)**: Dual-pane forecasting view (Individual Student Trajectory with 3–7 semester constraint & Whole-Class Cohort Prediction) with hero prediction card and RFC-4180 CSV export.
4. **OCR Review (`#tab-btn-ocr`)**: Mark sheet upload, page selector, canvas rectangular cropping boundary with interactive drag-and-drop handles, Web Worker recognition progress, and editable review table with student key reconciliation.
5. **Numerical Lab (`#tab-btn-lab`)**: Interactive educational sandbox hosting 5 sub-tabs:
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

---

## 7. Data-First Premium Redesign System (Phase 10 Modernization)

### 7.1 Core Tokens and CSS Namespace (`.cp-*`)
The redesign introduces centralized CSS custom properties in `css/main.css` and `css/components.css` shared by both `index.html` and `design-preview.html`:
- `--cp-surface-0` (`#07090d`): Global root background canvas.
- `--cp-surface-1` (`#0e1117`): Primary card/panel background.
- `--cp-surface-2` (`#141820`): Raised interactive elements, dialogs, and stepper headers.
- `--cp-surface-3` (`#1c222e`): Hover states and active filter chips.
- `--cp-line` (`#1f2633`): Subtle panel boundary dividers.
- `--cp-line-strong` (`#2e3749`): Emphasized boundaries and focus outlines.
- `--cp-accent` (`#f12f3e`): Restrained crimson primary brand color.
- `--cp-accent-soft` (`rgba(241, 47, 62, 0.12)`): Semi-transparent crimson badge & selection highlight.

### 7.2 Component Library
- **Academic Hero Banner (`.cp-academic-hero`)**: Compact header featuring project kicker `CSE NUMERICAL METHODS PROJECT`, product wordmark, contextual summary, and dataset action buttons without editorial stock photography or fabricated ratings.
- **Executive KPI Cards (`.cp-kpi-grid`, `.cp-kpi`)**: Reactively computes unique students, total accepted records, valid consecutive-semester transitions, and shared model status directly from session memory.
- **4-Panel Analytical Grid (`.cp-dashboard-grid`, `.cp-panel`)**: Composes 8-bin SGPA histogram, empirical transitions scatter plot, whole-class prediction preview table, and rolling-origin temporal validation comparison.
- **Seven-Stage OCR Stepper (`.cp-stepper`)**: Visual indicator mapping the complete human-in-the-loop ingestion flow: `Upload` → `Page` → `Crop` → `Extract` → `Review` → `Keys` → `Confirm`.
- **Responsive Table Container (`.cp-table-scroll`, `.cp-table`)**: Zero-document-overflow table wrapper with smooth horizontal scrolling for wide matrices and student rosters.
- **Interactive Laboratory Stage (`.cp-lab-stage`, `.cp-formula`, `.cp-step-controls`)**: Step-by-step augmented matrix and formula animators for Gaussian elimination, polynomial regressions, Newton divided differences, and Runge simulations.

### 7.3 Multi-Viewport Verification Evidence
Automated verification via Chrome DevTools Protocol (`tests/browser_ui_audit.mjs`) validates:
- Zero horizontal document overflow (`document.documentElement.scrollWidth <= window.innerWidth`) at 1440, 1280, 1024, 768, and 390px viewports.
- Zero browser console errors.
- Verified mobile drawer navigation toggle at 390px.
- Verified interactive tab switching and dataset demo loading.
- Real PNG screenshot artifacts saved under `docs/redesign/screenshots/`.
