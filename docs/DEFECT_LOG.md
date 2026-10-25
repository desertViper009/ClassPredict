# ClassPredict — Confirmed Defect Log & Remediation History

**Document Reference**: `docs/DEFECT_LOG.md`  
**Application**: ClassPredict  
**Auditor**: Senior QA Engineer, Application Security Reviewer, Frontend Specialist  
**Branch**: `redesign/data-first-premium-ui`  
**Total Defects Documented**: 5  
**Resolved Defects**: 5 (100%)  
**Unresolved Defects**: 0  

---

## Defect Summary Register

| Defect ID | Title | Severity | Impact Area | Regression Test Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-01** | Numerical Lab Control Desynchronization | High | UI / State Sync | `test_ui_contract.js: Lab Contract` | **FIXED** |
| **DEF-02** | Whole-Class Empty State Navigation Misdirection | High | User Navigation | `browser_ui_audit.mjs: Section 3` | **FIXED** |
| **DEF-03** | CSV Formula Injection via Student Pseudonyms (Whole-Class) | High | Security / Data Export | `test_prediction_service.js` | **FIXED** |
| **DEF-04** | Horizontal Viewport Overflow at 1280px & 1024px | Medium | Responsive CSS | `browser_ui_audit.mjs: Sections 1 & 2` | **FIXED** |
| **DEF-05** | Individual Prediction CSV Export Escaping & Neutralization | Medium | Security / Data Export | `test_prediction_service.js` | **FIXED** |

---

## Detailed Defect Reports

### DEF-01: Numerical Lab Control Desynchronization

```
+-----------------------------------------------------------------------------------------------------+
| DEF-01: Numerical Lab Control Desynchronization                                                     |
+-------------------+---------------------------------------------------------------------------------+
| Severity          | High (Functional UI & State Inconsistency)                                     |
| Component         | js/ui/numerical_lab_view.js, design-preview.html                                 |
| Date Identified   | October 25, 2026                                                                |
| Date Verified     | October 26, 2026                                                                |
+-------------------+---------------------------------------------------------------------------------+
```

#### Description
In both the production `NumericalLabView` and the standalone `design-preview.html`, switching the active experiment using the mobile/tablet select dropdown (`#lab-experiment-select` or `#preview-lab-select`) failed to update the active state of the desktop subtab buttons (`.pill-btn` / `.cp-lab-nav`), and vice versa. Users switching tabs saw inconsistent header kickers and desynchronized experiment content.

#### Reproduction Steps
1. Navigate to the Numerical Methods Lab workspace.
2. Observe default Experiment A (Gaussian Elimination) is active.
3. Change the dropdown select to "Experiment D (Runge's Phenomenon)".
4. Observe that the subtab navigation button for Experiment A remained highlighted with `.is-active`, while the content stage changed to Experiment D.
5. Click the "Linear vs. Quadratic Regression" subtab button.
6. Observe that the dropdown select value remained on "exp-d".

#### Root Cause
Event listeners on the select dropdown and the navigation buttons operated in isolation without a centralized synchronization dispatcher. Subtab button click handlers did not update `select.value`, and the `change` listener on the dropdown did not re-evaluate or toggle the `.is-active` / `.active` classes on sibling buttons.

#### Remediation
In `js/ui/numerical_lab_view.js` and `design-preview.html`:
1. Added unified state handler `setActiveSubtab(subtabId)` that updates both `this.activeSubtab`, queries `#lab-experiment-select` to set its `value`, and iterates all `.pill-btn[data-subtab]` to toggle `.is-active`.
2. Bound bidirectional `change` event listener on `#lab-experiment-select` to call `setActiveSubtab(e.target.value)`.
3. Updated kicker, title, and experiment container synchronously.

#### Verification & Evidence
- **Automated Test**: `tests/test_ui_contract.js` Suite "Premium UI: Numerical Methods Lab Contract", Case 2 & 3.
- **Browser Audit**: `tests/browser_ui_audit.mjs` Section 1 (preview lab sync) and Section 3 (production lab sync). Both confirmed bidirectional value and class alignment.
- **Status**: **VERIFIED FIXED**.

---

### DEF-02: Whole-Class Empty State Navigation Misdirection

```
+-----------------------------------------------------------------------------------------------------+
| DEF-02: Whole-Class Prediction Empty State Navigation Misdirection                                 |
+-------------------+---------------------------------------------------------------------------------+
| Severity          | High (Broken User Journey)                                                      |
| Component         | js/ui/prediction_view.js                                                        |
| Date Identified   | October 25, 2026                                                                |
| Date Verified     | October 26, 2026                                                                |
+-------------------+---------------------------------------------------------------------------------+
```

#### Description
When navigating to the Whole-Class prediction workspace with an empty dataset session, an empty state card displays with an action button `#btn-nav-dataset` prompting the user: "Load a historical SGPA dataset to run cohort-wide trajectory predictions." Clicking this button threw a silent JavaScript error or failed to navigate, leaving the user stranded on the empty prediction screen.

#### Reproduction Steps
1. Load `index.html` with no dataset in session memory.
2. Click "Whole-Class Prediction" in the sidebar navigation.
3. Observe the empty state banner with the button `#btn-nav-dataset`.
4. Click `#btn-nav-dataset`.
5. Observe that the workspace does not navigate to Dataset Management.

#### Root Cause
In `prediction_view.js`, the event listener on `#btn-nav-dataset` attempted to trigger a click on `#tab-btn-dataset` or `#tab-btn-dashboard`. In the approved Data-First redesign, the navigation shell uses `[data-nav-id="dataset"]` and exports `navigateTo('dataset')` rather than legacy `#tab-btn-*` selectors.

#### Remediation
In `js/ui/prediction_view.js`:
Replaced legacy DOM element click triggers with the application shell navigation handler:
```javascript
btnNavDataset.addEventListener('click', (e) => {
  e.preventDefault();
  const datasetNav = document.querySelector('[data-nav-id="dataset"]');
  if (datasetNav) {
    datasetNav.click();
  } else if (typeof window.navigateTo === 'function') {
    window.navigateTo('dataset');
  }
});
```

#### Verification & Evidence
- **Automated Test**: `tests/browser_ui_audit.mjs` Section 3 (line 521).
- **Observed Result**: `Verified whole-class prediction navigation target: true`. Navigated cleanly to Dataset Management and updated breadcrumb title.
- **Status**: **VERIFIED FIXED**.

---

### DEF-03: CSV Formula Injection Vulnerability (Whole-Class Export)

```
+-----------------------------------------------------------------------------------------------------+
| DEF-03: CSV Formula Injection Vulnerability in Pseudonymous Student Keys                            |
+-------------------+---------------------------------------------------------------------------------+
| Severity          | High (Application Security / CWE-1236)                                          |
| Component         | js/core/prediction_service.js                                                    |
| Date Identified   | October 25, 2026                                                                |
| Date Verified     | October 26, 2026                                                                |
+-------------------+---------------------------------------------------------------------------------+
```

#### Description
When exporting Whole-Class prediction records to CSV (`#btn-export-class`), student keys originating from uploaded transcripts or CSV datasets were placed into CSV rows without formula prefix sanitization. If an imported student identifier started with formula trigger characters (`=`, `+`, `-`, `@`), spreadsheet applications such as Microsoft Excel or LibreOffice Calc would evaluate the cell as a dynamic formula/DDE command upon opening, potentially executing arbitrary commands or exfiltrating data.

#### Reproduction Steps
1. Ingest a synthetic dataset containing student keys such as `=SUM(1,2)`, `@HYPERLINK(...)`, or `+CMD|' /C ...'`.
2. Generate Whole-Class predictions.
3. Click "Export Predictions (CSV)".
4. Inspect the generated CSV text.
5. Cells began with raw `=`, `+`, `-`, or `@`.

#### Root Cause
`exportClassPredictionsCSV` in `js/core/prediction_service.js` only enclosed fields in double quotes without checking for formula trigger characters. In spreadsheet processors, double quotes do NOT neutralize leading formula characters (e.g., `"=cmd"` is still evaluated as a formula).

#### Remediation
Implemented formula neutralization per OWASP CSV Injection guidelines in `js/core/prediction_service.js`:
```javascript
function sanitizeCsvCell(value) {
  if (value == null) return '""';
  let str = String(value);
  // Neutralize formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  // RFC-4180 double-quote escaping
  if (/[",\n\r]/.test(str) || str.startsWith("'")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

#### Verification & Evidence
- **Automated Test**: `tests/test_prediction_service.js` Case "should mitigate formula injection by prefixing formula trigger characters with single quote".
- **Observed Result**: Keys starting with `=`, `+`, `-`, `@` are safely prepended with `'` and enclosed in quotes (`"'=SYN_001'"`). Valid numeric values (`3.45`) and unproblematic identifiers are unaltered.
- **Status**: **VERIFIED FIXED**.

---

### DEF-04: Horizontal Viewport Overflow at 1280px & 1024px

```
+-----------------------------------------------------------------------------------------------------+
| DEF-04: Horizontal Viewport Overflow at 1280px & 1024px Viewports                                   |
+-------------------+---------------------------------------------------------------------------------+
| Severity          | Medium (Layout & Visual Degradation)                                            |
| Component         | css/main.css, css/components.css                                                |
| Date Identified   | October 25, 2026                                                                |
| Date Verified     | October 26, 2026                                                                |
+-------------------+---------------------------------------------------------------------------------+
```

#### Description
Browser audits at 1280px (standard laptop) and 1024px (tablet landscape) revealed horizontal scrolling (`scrollWidth > innerWidth + 1`). Document scrollWidth measured up to 1297px on a 1280px viewport and 1041px on a 1024px viewport, causing an unwanted horizontal scrollbar.

#### Reproduction Steps
1. Open headless Chrome CDP session at viewport `1280x800` or `1024x768`.
2. Evaluate `document.documentElement.scrollWidth > window.innerWidth`.
3. Observe overflow of 17px at 1280px and 17px at 1024px.

#### Root Cause
1. In `css/main.css`, `#sidebar-backdrop` had `width: 100vw; height: 100vh;`. On Windows, `100vw` includes the vertical scrollbar width (typically 17px), while `window.innerWidth` excludes it, causing a permanent 17px overflow.
2. In `css/components.css`, certain `.card` and `.cp-panel` flex containers lacked `min-width: 0;` and `max-width: 100%;`, allowing wide tables to push the container beyond viewport boundaries.

#### Remediation
1. Changed `#sidebar-backdrop` from `width: 100vw; height: 100vh;` to `position: fixed; inset: 0; width: 100%; height: 100%;`.
2. Added `box-sizing: border-box; max-width: 100%;` and `overflow-x: auto;` to container wrappers.
3. Ensured `html, body { overflow-x: hidden; max-width: 100%; }`.

#### Verification & Evidence
- **Automated Test**: `tests/browser_ui_audit.mjs` Section 1 and Section 2.
- **Observed Result**:
  - `design-preview.html [1280x800]`: No horizontal overflow (1273 <= 1280)
  - `design-preview.html [1024x768]`: No horizontal overflow (1017 <= 1024)
  - `index.html empty & loaded [1280x800]`: No horizontal overflow (1273 <= 1280)
  - `index.html empty & loaded [1024x768]`: No horizontal overflow (1017 <= 1024)
- **Status**: **VERIFIED FIXED**.

---

### DEF-05: Individual Prediction CSV Export Escaping & Neutralization

```
+-----------------------------------------------------------------------------------------------------+
| DEF-05: Individual Prediction CSV Export Formula Neutralization Gap                                 |
+-------------------+---------------------------------------------------------------------------------+
| Severity          | Medium (Application Security / Consistency)                                     |
| Component         | js/core/prediction_service.js                                                    |
| Date Identified   | October 26, 2026                                                                |
| Date Verified     | October 26, 2026                                                                |
+-------------------+---------------------------------------------------------------------------------+
```

#### Description
While Whole-Class export (`exportClassPredictionsCSV`) had formula injection neutralization applied, the Individual Prediction CSV exporter (`exportIndividualCSV`) exported model names, baseline labels, and custom trajectory metadata directly without verifying leading formula trigger characters (`=`, `+`, `-`, `@`) or escaping inner double quotes.

#### Reproduction Steps
1. Navigate to Individual Prediction workspace.
2. Compute predictions with custom model name or student label starting with `=`.
3. Click export individual predictions.
4. Output contained unescaped formulas.

#### Root Cause
In `prediction_service.js`, `exportIndividualCSV` used direct string interpolation (`${modelName},${targetSemester},...`) without routing values through the centralized `sanitizeCsvCell` helper.

#### Remediation
Updated `exportIndividualCSV` to route all string fields (`student_key`, `model_name`, `status`, `baseline_model`) through `sanitizeCsvCell`, prepending `'` on trigger characters and RFC-4180 escaping inner quotes.

#### Verification & Evidence
- **Automated Test**: `tests/test_prediction_service.js` Suite "Phase 7: Prediction Engine & Export Safety".
- **Observed Result**: Both Whole-Class and Individual prediction exports produce uniformly sanitized, formula-safe CSV downloads.
- **Status**: **VERIFIED FIXED**.
