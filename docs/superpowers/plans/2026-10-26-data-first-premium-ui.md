# ClassPredict Data-First Premium UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a shared design preview and a complete data-first premium redesign of ClassPredict without changing its numerical, validation, OCR safety, or privacy behavior.

**Architecture:** Preserve the pure numerical/service modules and refactor only the shell, view templates, and shared CSS. The preview and production app consume the same token and component styles; view state remains managed by the existing in-memory state manager.

**Tech Stack:** HTML5, CSS3 custom properties, vanilla ES modules, inline responsive SVG charts, Node.js test harness, Playwright browser automation.

**Spec:** `docs/superpowers/specs/2026-10-26-data-first-premium-ui-design.md`

## Global Constraints

- Preserve the existing HTML/CSS/vanilla JavaScript architecture and module boundaries.
- Do not introduce a backend, database, telemetry, sensitive-data persistence, or unnecessary dependencies.
- Do not alter numerical algorithms merely to simplify UI rendering.
- Do not display fabricated metrics or unsupported claims.
- Do not weaken or delete existing tests.
- Do not deploy before local implementation and verification are complete.

## Review Focus

- A 390px viewport must show every critical action without page-level clipping.
- A wide whole-class result set must scroll inside its table region without widening the document.
- Invalid CSV and unconfirmed OCR content must leave the accepted dataset untouched.
- Empty/insufficient evaluation states must never display invented values.
- Drawer, tabs, dialogs, and step controls must remain keyboard operable with visible focus.

---

### Task 1: Shared design system and functional preview

**Files:**
- Create: `design-preview.html`
- Create: `js/design_preview.js`
- Modify: `css/main.css`
- Modify: `css/components.css`
- Test: `tests/test_ui_contract.js`
- Modify: `tests/test_runner.js`

**Interfaces:**
- Produces: shared `.app-*`, `.cp-*`, button, form, card, table, alert, badge, chart, stepper, drawer, and responsive utility contracts used by all later tasks.

- [ ] Add a failing UI contract test asserting a standalone preview, centralized tokens, reduced-motion handling, and no editorial image references.
- [ ] Run `npm test` and confirm the new contract test fails.
- [ ] Implement the token system and functional preview navigation using clearly labeled synthetic data.
- [ ] Run `npm test` and confirm all tests pass.

### Task 2: Application shell and navigation

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/main.css`
- Test: `tests/test_ui_contract.js`

**Interfaces:**
- Consumes: shared shell and navigation classes from Task 1.
- Produces: `navigateTo(tabName, options)`, one desktop sidebar, mobile drawer, compact top bar, and distinct prediction-mode navigation.

- [ ] Add shell contract assertions for unique IDs, one desktop navigation, real status actions, and individual/class prediction routes.
- [ ] Run `npm test` and verify the assertions fail.
- [ ] Replace the competing navigation structures and synchronize active/expanded states with the existing view mounting logic.
- [ ] Run `npm test` and verify all tests pass.

### Task 3: Overview dashboard and charts

**Files:**
- Modify: `js/ui/dashboard_view.js`
- Modify: `css/components.css`
- Test: `tests/test_ui_contract.js`

**Interfaces:**
- Consumes: `computeCohortOverview`, distribution, scatter, residual, temporal-evaluation, transition-matrix, and unusual-observation analytics.
- Produces: compact data-first overview markup with only computed or explicitly unavailable metrics.

- [ ] Add failing assertions excluding star ratings, hardcoded MAE, and editorial assets while requiring real KPI/chart/prediction regions.
- [ ] Replace the image-led hero with compact dataset context and analytics-first composition.
- [ ] Make tabs, legends, charts, and preview tables responsive and keyboard accessible.
- [ ] Run `npm test` and verify all tests pass.

### Task 4: Dataset and prediction workflows

**Files:**
- Modify: `js/ui/dataset_view.js`
- Modify: `js/ui/prediction_view.js`
- Modify: `css/components.css`
- Test: `tests/test_ui_contract.js`

**Interfaces:**
- Consumes: existing state manager, validator, prediction service, sorting/filtering, and CSV export functions.
- Produces: accessible import/status/record layouts and responsive individual/whole-class workspaces.

- [ ] Add failing UI assertions for import status, safe destructive actions, prediction mode headings, scroll-contained class table, and 44px primary controls.
- [ ] Refactor presentational inline declarations into shared classes while retaining dynamic values only where necessary.
- [ ] Verify valid/invalid import, individual prediction, class filters/sorts, and exports in browser automation.
- [ ] Run `npm test` and verify all tests pass.

### Task 5: Seven-stage OCR review experience

**Files:**
- Modify: `js/ui/ocr_view.js`
- Modify: `css/components.css`
- Test: `tests/test_ui_contract.js`

**Interfaces:**
- Consumes: existing OCR service state, crop transforms, candidate review, key reconciliation, and atomic commit functions.
- Produces: visible seven-stage progress semantics mapped onto the existing safe state machine.

- [ ] Add failing assertions for all seven workflow labels and accurate local-processing copy.
- [ ] Implement the responsive document workspace, stepper, review statuses, and aligned crop container without weakening confirmation rules.
- [ ] Verify synthetic OCR upload, crop invalidation, review, cancellation, reconciliation, and commit.
- [ ] Run `npm test` and verify all tests pass.

### Task 6: Numerical Methods Lab redesign

**Files:**
- Modify: `js/ui/numerical_lab_view.js`
- Modify: `css/components.css`
- Test: `tests/test_ui_contract.js`

**Interfaces:**
- Consumes: existing Gaussian, regression comparison, Newton interpolation, Runge, and stability experiment reports.
- Produces: responsive experiment navigation, accessible step controls, matrix/formula panels, and plots.

- [ ] Add failing assertions covering every experiment and accessible responsive navigation.
- [ ] Redesign only the laboratory presentation and event wiring, preserving numerical calls and results.
- [ ] Exercise every experiment and Gaussian trace navigation in browser automation.
- [ ] Run `npm test` and verify all tests pass.

### Task 7: Responsive, accessibility, documentation, and release verification

**Files:**
- Modify: `css/main.css`
- Modify: `css/components.css`
- Modify: `README.md`
- Modify: `docs/UI_UX_DESIGN.md`
- Modify: `docs/CHANGELOG.md`
- Create: `tests/browser_ui_audit.mjs`
- Create: `docs/redesign/BEFORE_AFTER.md`
- Create: `docs/redesign/screenshots/*`

**Interfaces:**
- Consumes: all redesigned pages and shared component contracts.
- Produces: repeatable browser audit and documented preview/deployment handoff.

- [ ] Implement a browser audit for 1440x900, 1280x800, 1024x768, 768x1024, and 390x844 that checks overflow, console errors, navigation, focus, and representative actions.
- [ ] Capture before/after application and design-preview screenshots from real renders.
- [ ] Run `npm test` and require 226 legacy tests plus all new UI contract tests to pass.
- [ ] Run the browser audit and fix every critical functional, console, and clipping regression.
- [ ] Update design-system, page, responsive, changelog, local-preview, and GitHub Pages documentation.
- [ ] Review the diff for fabricated metrics, dead actions, editorial assets, accidental core-engine changes, and unrelated modifications.

