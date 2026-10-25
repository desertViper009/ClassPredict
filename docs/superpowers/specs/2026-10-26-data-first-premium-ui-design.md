# ClassPredict Data-First Premium UI Design

## Intent

Transform ClassPredict into a portfolio-quality academic analytics product for a university presentation, professional showcase, and real use. The redesign must surface trustworthy data immediately, preserve every numerical and privacy guarantee, and eliminate irrelevant editorial imagery and unsupported claims.

## Goals

- Use a single persistent desktop sidebar and a compact, accessible mobile drawer.
- Put live dataset status, KPIs, charts, validation evidence, and prediction previews above decorative content.
- Establish one token-driven component system for both a standalone visual preview and the production application.
- Redesign dataset, individual prediction, whole-class prediction, OCR, and Numerical Lab workflows without changing their numerical engines.
- Resolve clipping, wide-table, undersized-control, chart-legibility, and crop-overlay defects at 1440, 1280, 1024, 768, and 390 pixel widths.
- Keep all visible actions real and all metrics derived from accepted data or explicitly labeled synthetic data.

## Non-goals

- No backend, database, telemetry, framework migration, or sensitive-data persistence.
- No changes to mathematical algorithms solely for presentation.
- No fabricated accuracy, rating, client, or performance claims.
- No decorative search, activity feed, documentation route, or theme control unless it performs a real action.

## Anti-goals

- Do not hide layout defects with page-level horizontal clipping.
- Do not create a second unrelated design system for the preview.
- Do not replace working features with static mockups.
- Do not deploy over the current live GitHub Pages site before local verification and user approval.

## Constraints

- Preserve vanilla HTML, CSS, and ES module architecture.
- Preserve the in-memory state model and OCR confirmation barrier.
- Keep external OCR/PDF assets accurately described; do not claim fully offline operation.
- Retain all existing tests and add UI structure/browser checks where practical.

## Approaches

### Selected: Shared-system incremental modernization

Retain all core and service modules, replace the application shell, consolidate reusable styles, and reshape each view around existing state and actions. A standalone `design-preview.html` uses the same CSS components and labeled synthetic content. This provides the safest path to a full redesign while keeping numerical behavior stable.

### Considered: CSS-only reskin

Lower implementation risk, but rejected because duplicate navigation, inaccessible touch targets, hardcoded claims, inline layout rules, and workflow hierarchy cannot be fixed reliably with palette overrides alone.

### Considered: Framework rewrite

Could improve component composition, but rejected because it adds build and dependency complexity, increases regression risk, and violates the instruction to preserve the existing vanilla architecture.

## Product Structure

- Desktop: 264px sidebar, compact contextual top bar, responsive content workspace.
- Mobile/tablet: off-canvas drawer, compact header, single-column content, scroll-contained wide tables.
- Overview: compact product heading, dataset provenance badge, KPI row, distribution/scatter/evaluation panels, prediction preview.
- Dataset: import action zone, schema guidance, validation results, accepted summary, safe destructive actions, record preview.
- Predictions: shell navigation opens the correct individual or whole-class mode; existing model, validation, sorting, filtering, and export behavior is retained.
- OCR: seven-stage stepper over the existing safe upload/crop/review/reconcile/commit state machine.
- Lab: responsive experiment navigation, clearer matrices, formulas, step controls, and plots.

## Visual System

- Near-black canvas with layered charcoal surfaces and restrained crimson emphasis.
- Inter/system typography with tabular monospace only for numerical data.
- 4/8px spacing rhythm, 12–18px radii, quiet one-pixel borders, limited elevation.
- Minimum 44px primary touch targets where practical, strong `:focus-visible`, reduced-motion support.
- Semantic status colors reserved for information, success, warning, and danger.

## Responsive Behavior

- Sidebar collapses below 1100px and never competes with a second desktop navigation bar.
- Analytical grids move from 12-column desktop compositions to two columns and then one column.
- Charts use responsive SVG view boxes and compact legends.
- Wide tables scroll inside labeled containers; the document never widens with them.
- OCR canvas and crop overlay share one positioned, responsive coordinate container.

## Verification

- Run the full 226-test baseline before and after changes.
- Browser automation exercises all primary navigation, demo loading, prediction modes, OCR stages, lab experiments, mobile drawer, console errors, overflow, and focus visibility.
- Capture actual before/after screenshots from the application and preview.

