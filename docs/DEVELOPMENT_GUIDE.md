# Development Guide & Change Management — ClassPredict

> **Document ID**: DOC-DEV-001  
> **Status**: Approved & Verified (Phase 10 Production Deployment & Hardening Complete)  
> **Lifecycle State**: Deployed & Verified  
> **Last Updated**: October 2026

---

## 1. Repository Structure & Directory Conventions

The repository maintains strict separation between documentation, pure numerical logic, user interface components, and verification test suites:

```text
ClassPredict/
├── .gitignore                      # Privacy & build artifact exclusion
├── package.json                    # Minimal test script configuration (npm test)
├── README.md                       # Project entry point & status matrix
├── index.html                      # Minimal HTML entry point
│
├── css/                            # Vanilla CSS3 Design System
│   ├── main.css                    # Obsidian/Crimson tokens & layout foundation
│   ├── components.css              # Cards, tables, modals, badges, OCR crop & review styles
│   └── views.css                   # View-specific layout rules
│
├── js/                             # Modular ES6 JavaScript Codebase
│   ├── app.js                      # Application initialization & tab router
│   │
│   ├── core/                       # Pure Numerical & Validation Core (NO DOM)
│   │   ├── linear_algebra.js       # Gaussian elimination, scale-aware pivoting
│   │   ├── regression_engine.js    # Least-squares fitting, centering, variance checks
│   │   ├── interpolation_engine.js # Newton divided differences
│   │   ├── temporal_validator.js   # Rolling-origin evaluation engine
│   │   ├── data_validator.js       # CSV parsing, schema, duplicate checks
│   │   └── ocr_engine.js           # Candidate parsing, coordinate transform, key reconciliation
│   │
│   ├── services/                   # Application Services
│   │   ├── state_manager.js        # Reactive in-memory session store & atomic commitment
│   │   ├── prediction_service.js   # Individual & class forecasting workflows, RFC-4180 export
│   │   └── ocr_service.js          # Web Worker controller for Tesseract & PDF.js
│   │
│   └── ui/                         # Presentation Layer (DOM Manipulators)
│       ├── dashboard_view.js       # Metrics & SVG charts
│       ├── prediction_view.js      # Single & cohort prediction UI
│       ├── ocr_view.js             # Canvas crop & key reconciliation table
│       └── lab_view.js             # Numerical laboratory playground
│
├── docs/                           # Authoritative Documentation System
│   ├── INDEX.md                    # Documentation navigation
│   ├── PROJECT_CHARTER.md          # Purpose, stakeholders, boundaries
│   ├── REQUIREMENTS.md             # Functional (FR) & NFR specifications
│   ├── ARCHITECTURE.md             # Topology, data flows, Mermaid diagrams
│   ├── DATA_DICTIONARY.md          # Schemas, fields, missing data policy
│   ├── NUMERICAL_MODEL.md          # Mathematics, derivations, stability
│   ├── VALIDATION_AND_TESTING.md   # Backtesting strategy, test cases
│   ├── PRIVACY_SECURITY.md         # Privacy architecture & threat model
│   ├── UI_UX_DESIGN.md             # Obsidian/crimson design tokens & UI specs
│   ├── DEVELOPMENT_GUIDE.md        # Conventions & change rules (this file)
│   ├── USER_GUIDE.md               # End-user operating procedures
│   ├── DEPLOYMENT_GUIDE.md         # Hosting & local server instructions
│   ├── DEMO_PLAN.md                # Viva presentation script & portfolio
│   ├── KNOWN_LIMITATIONS.md        # Model bounds, sample constraints
│   ├── DECISIONS.md                # ADR index & status
│   ├── adr/                        # Individual Architectural Decision Records
│   │   ├── ADR-001-technology-stack.md
│   │   ├── ADR-002-model-selection.md
│   │   ├── ADR-003-dataset-schema.md
│   │   ├── ADR-004-ocr-and-privacy-workflow.md
│   │   ├── ADR-005-persistence-vs-session-only-data.md
│   │   └── ADR-006-validation-strategy.md
│   ├── TRACEABILITY_MATRIX.md      # Requirement-to-Test mapping
│   └── CHANGELOG.md                # Chronological modification log
│
├── samples/                        # Sample & Verification Datasets
│   └── sample_class_sgpa.csv       # Synthetic 10-student verification template
│
└── tests/                          # Automated Verification Test Suite
    ├── test_runner.js              # Lightweight headless test harness
    ├── test_foundation.js          # Phase 2 foundation & arithmetic tests
    ├── test_linear_algebra.js      # System solvers & partial pivoting (Phase 4)
    ├── test_regression.js          # Normal equations & conditioning (Phase 4)
    ├── test_interpolation.js       # Newton divided differences (Phase 4)
    ├── test_validation.js          # Temporal rolling-origin splits (Phase 5)
    ├── test_csv_parser.js          # Schema boundary & duplicate checks (Phase 3)
    ├── test_prediction.js          # Prediction workflows & CSV export tests (Phase 6)
    └── test_ocr.js                 # Privacy-preserving OCR & key reconciliation tests (Phase 7)
```

---

## 2. Environment Setup & Development Conventions

### 2.1 Tooling Requirements:
* **To Run the Application**: A modern web browser + a local HTTP server (`python -m http.server 8000` or `npx serve`). Opening via `file://` is blocked by browser CORS restrictions on ES6 modules.
* **To Run Automated Tests**: Node.js LTS (v18+) for running the headless test suite (`npm test`). Node.js is not needed to host the static application.

---

## 3. Strict Decoupling Rule: Pure Numerical Core

The `/js/core/` directory contains pure mathematical algorithms. 

> [!IMPORTANT]
> **Strict Separation Rule**:
> * Files in `/js/core/` must **NEVER** import from `/js/ui/`.
> * Files in `/js/core/` must **NEVER** reference `window`, `document`, `HTMLElement`, or any DOM API.
> * Core functions must accept raw arrays/matrices of numbers and return deterministic objects.
> * This guarantees that every mathematical calculation can be unit-tested directly in a headless Node.js test runner without mocking DOM objects.

---

## 4. Mandatory Change Management Rules

1. **Read Relevant Documentation First**: Before editing any code, review the corresponding requirement in `REQUIREMENTS.md` and mathematical formulation in `NUMERICAL_MODEL.md`.
2. **Identify Affected Components**: Determine whether changes impact schemas, validation rules, or test cases.
3. **Make the Smallest Coherent Change**: Avoid sweeping multi-file refactors in a single commit.
4. **Write or Update Tests**: Every numerical fix or validation rule must have a corresponding test case in `/tests/`.
5. **Run the Test Suite**: Execute the verification tests before declaring the task complete.
6. **Update Documentation in the Same Commit**: If a function signature, schema, or algorithm changes, update the markdown documentation immediately.
7. **Update the Changelog**: Document significant architectural or numerical updates in `docs/CHANGELOG.md`.
8. **Update the Traceability Matrix**: Keep `docs/TRACEABILITY_MATRIX.md` aligned with requirement implementation states.
9. **Transparent Change Reporting**: State exactly what files changed, what tests ran, and what results were observed.
10. **Never Claim False Passes**: Never report a test as passing unless it was actually executed and verified.
