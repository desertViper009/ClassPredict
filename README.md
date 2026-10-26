# Gradivue

> **See performance. Understand progress.**  
> **Product Category**: Academic Analytics Platform  
> **Academic Context**: University Computer Science & Engineering (CSE) Undergraduate Final Project for **Numerical Methods**.  
> **Status**: **Phase 10 Production Release & Data-First Premium Redesign Complete (246/246 Tests Passing)**.  
> **Repository**: [https://github.com/desertViper009/ClassPredict](https://github.com/desertViper009/ClassPredict)  
> **Live Web Application (GitHub Pages)**: [https://desertviper009.github.io/ClassPredict/](https://desertviper009.github.io/ClassPredict/)  
> **Live Web Application (Vercel Target)**: [https://gradivue.vercel.app](https://gradivue.vercel.app)

---

## 1. Executive Summary

**Gradivue** is a web-based academic analytics application for SGPA forecasting, dataset management, whole-class prediction, privacy-conscious result-sheet ingestion, and numerical methods education. Developed as an academic capstone for a Numerical Methods course, the software demonstrates the practical application of numerical linear algebra, predictor centering, least-squares curve fitting, polynomial approximation, interpolation, and temporal validation on empirical academic transitions.

The application addresses five primary operational workflows:
1. **Interactive Numerical Methods Laboratory**: Step-by-step augmented matrix Gaussian elimination with scale-aware partial pivoting, linear vs. centered quadratic regression comparison on identical data with condition squaring analysis, Newton divided-difference interpolation tables with extrapolation boundary alerts, Runge's phenomenon simulation contrasting equally spaced vs. Chebyshev nodes, and comprehensive numerical stability topics.
2. **Analytical Dashboard & Data Visualization**: Interactive cohort overview, semester-by-semester SGPA distributions (uniform histograms & Tukey boxplots), transition scatter plots with fitted regression lines ($y = a + b\,x$), in-sample training residual diagnostics, holdout temporal evaluation comparison against persistence, transition summary availability matrix, and deterministic $1.5 \times \text{IQR}$ unusual observation review candidates.
3. **Individual Student Prediction**: Estimating the upcoming semester SGPA for a student based on their unique, variable historical trajectory (3 to 7 completed semesters), with statistical uncertainty warnings grounded in residual degrees of freedom ($\nu = K - 2$).
4. **Whole-Class Cohort Prediction**: Modeling consecutive-semester transition dynamics across an entire class cohort (typically 40–80 students) from validated, anonymized long-format datasets.
5. **Privacy-Preserving OCR Mark-Sheet Ingestion**: Optical Character Recognition extraction of numeric SGPA records from scanned university PDF/image documents featuring user-controlled cropping, Web Worker processing, and a mandatory key reconciliation barrier.

---

## 2. Project Lifecycle Status Matrix

To maintain academic rigor and transparency, features and components are explicitly tagged across standardized lifecycle states:

| Lifecycle State | Description | Current Project Status |
| :--- | :--- | :--- |
| **Planned** | Requirements documented, scoped, and prioritized | Completed (All 10 Phases & Redesign Implemented & Verified) |
| **Designed** | Mathematical formulation, data schemas, and UI specs complete | All Modules (Complete in `/docs`) |
| **Implemented** | Source code written and operational in workspace | Phase 2 Foundation, Phase 3 Dataset Layer, Phase 4 Numerical Engine, Phase 5 Evaluation Engine, Phase 6 Prediction Workflows, Phase 7 Privacy-Preserving OCR, Phase 8 Analytical Dashboard, Phase 9 Educational Laboratory, & Phase 10 Production Hardening (`FR-01` through `FR-08`, `NFR-01` through `NFR-05`) |
| **Tested** | Automated unit, numerical, integration, UI contract, and browser tests passing | **246 Automated Tests Passing** across 47 suites (`test_foundation.js`, `test_csv_parser.js`, `test_linear_algebra.js`, `test_regression.js`, `test_interpolation.js`, `test_validation.js`, `test_prediction.js`, `test_ocr.js`, `test_dashboard.js`, `test_numerical_lab.js`, `test_release_hardening.js`, `test_ui_contract.js`, `browser_ui_audit.mjs`) |
| **Verified** | Evaluated against baseline benchmarks on temporal test splits & 5 responsive viewports | **`Verified` (Phase 10 & Data-First Redesign Complete: Multi-Viewport CDP Audit Clear, 0 Horizontal Overflow, 0 Console Errors)** |
| **Deployed** | Packaged and accessible in production environment | **`Deployed & Live`**: GitHub Pages: [https://desertviper009.github.io/ClassPredict/](https://desertviper009.github.io/ClassPredict/) · Vercel Target: [https://gradivue.vercel.app](https://gradivue.vercel.app) |

---

## 3. Core Numerical Capabilities & Academic Foundation

Gradivue avoids opaque black-box machine learning libraries, implementing core numerical algorithms from first principles:

* **Model A: Persistence Baseline**: $\hat{s}_{t+1} = s_t$. The non-trivial null hypothesis against which all statistical models are evaluated. Deployed as a fallback under explicitly documented conditions (near-zero input variance, scale-aware pivot failure, non-finite values, or $M < 2$).
* **Model B: Class-Wide Linear Regression**: Consecutive transition model $s_{t+1} = a + b\,s_t + \epsilon$ solved via Normal Equations $(X^T X)\mathbf{\beta} = X^T \mathbf{y}$ with **predictor centering** ($x - \bar{x}$) to decouple off-diagonal covariance and **Gaussian Elimination with scale-aware row partial pivoting**.
* **Model C: Individual Least-Squares Trend**: Student-specific temporal trend $s_k = a + b\,k$ with statistical volatility warnings based on residual degrees of freedom ($\nu = K - 2$).
* **Model D: Experimental Polynomial Fit**: Degree-2 parabolic model $s_k = a + b\,k + c\,k^2 + \epsilon_k$ evaluated strictly in the educational laboratory to demonstrate $3 \times 3$ system solving, highlighting the dangers of overfitting on short sequences.
* **Newton Divided-Difference Interpolation**: Educational demonstration contrasting exact historical interpolation against forward-looking numerical extrapolation.
* **Runge Phenomenon & Risk Simulation**: Educational evaluation of high-degree polynomial divergence on $f(x) = 1/(1+25x^2)$ comparing equally spaced vs. Chebyshev node distributions.
* **Temporal Rolling-Origin Evaluation**: Expanding-window backtesting ensuring zero future-to-past data leakage.
* **Raw Out-of-Range Display Policy**: Never silently clips predictions. The raw mathematical extrapolation is always displayed as the primary output, accompanied by an explicit warning badge if out of bounds.

---

## 4. Privacy & Ethical Guardrails

Academic records constitute sensitive personal data. Gradivue implements strict architectural privacy constraints:
* **Zero PII Ingestion & Whitelist Schema**: Datasets strictly require only `student_key`, `semester_no`, and `sgpa`. Unexpected columns (names, roll numbers, emails) are immediately rejected with actionable guidance.
* **Diagnostic Anonymity**: Error diagnostics cite row numbers and issue categories without printing raw student names or marks into logs or UI banners.
* **Stable Pseudonymous Keys & Key Reconciliation**: Students retain the same pseudonymous key across semesters. Student identity is **never** inferred from OCR row position.
* **Client-Side Execution & In-Memory Isolation**: All CSV parsing, normalization, and linear algebra execute entirely within the local browser memory. Staging protection guarantees that invalid uploads do not overwrite an active accepted dataset. Clicking discard purges all records from browser memory.
* **Targeted Crop OCR**: Mark sheets are cropped to the SGPA column *before* OCR ingestion, ensuring surrounding personal information (student names, roll numbers, registration IDs) never touches the OCR parser. All document bytes and crop sub-canvases remain strictly ephemeral in browser RAM.
* **Strict Service Worker Privacy**: The offline caching service worker (`sw.js`) caches only immutable static application assets; it explicitly ignores and never caches user uploads, blob URLs, or student records.

---

## 5. Runtime, Deployment & CI/CD Tooling

* **To Run Locally**: Any modern web browser + a local static HTTP server (`python -m http.server 8000` or `npx serve`) required for native ES6 module imports.
* **To Run Tests**: Node.js LTS (v18+) required **only** for developer test execution (`npm test`). Node.js is not a backend server for the web app.
* **Static Deployment**: Automatically deployed to GitHub Pages via `.github/workflows/deploy.yml` upon push to `main` (requires all 226 tests to pass).
* **Offline Shell**: Service Worker (`sw.js`) automatically caches the application shell on initial HTTP load. The header status badge indicates `Online` or `Offline Shell`.

---

## 6. Sample Dataset Notice

The sample dataset located at [`samples/sample_class_sgpa.csv`](samples/sample_class_sgpa.csv) is explicitly tagged as **synthetic demonstration data**. It contains artificially generated academic records for educational testing and must never be represented as real university data.

---

## 7. Documentation Directory Map

* **[Documentation Index](docs/INDEX.md)**: Master navigation guide.
* **[Project Charter](docs/PROJECT_CHARTER.md)**: Scope, stakeholders, constraints, and success criteria.
* **[Requirements Specification](docs/REQUIREMENTS.md)**: Functional (FR-01 to FR-08) and non-functional requirements.
* **[System Architecture](docs/ARCHITECTURE.md)**: Component design, data flows, and architectural diagrams.
* **[Data Dictionary & Schemas](docs/DATA_DICTIONARY.md)**: CSV structure, validation rules, and sample files.
* **[Numerical Model Specification](docs/NUMERICAL_MODEL.md)**: Mathematical derivations, scale-aware conditioning, normal equations, and pseudocode.
* **[Validation & Testing Strategy](docs/VALIDATION_AND_TESTING.md)**: Rolling-origin backtesting, MAE/RMSE formulas, and test suites.
* **[Privacy & Security Architecture](docs/PRIVACY_SECURITY.md)**: Threat modeling, pseudonymization, key reconciliation, and zero-storage policies.
* **[UI/UX Design Specification](docs/UI_UX_DESIGN.md)**: Obsidian/crimson dark aesthetic, accessibility, and portfolio storyboard.
* **[Development Guide](docs/DEVELOPMENT_GUIDE.md)**: Conventions, workflow, and safe change rules.
* **[User & Evaluator Guide](docs/USER_GUIDE.md)**: Step-by-step operating instructions.
* **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)**: Local serving and static hosting procedures.
* **[Demonstration & Defense Plan](docs/DEMO_PLAN.md)**: University viva presentation script and portfolio presentation.
* **[Known Limitations](docs/KNOWN_LIMITATIONS.md)**: Dataset constraints, sample size limits, and mathematical bounds.
* **[Architectural Decision Records (ADR Index)](docs/DECISIONS.md)**: ADR-001 through ADR-006.
* **[Traceability Matrix](docs/TRACEABILITY_MATRIX.md)**: Requirement-to-design-to-verification mapping.
* **[Changelog](docs/CHANGELOG.md)**: Historical tracking of project updates.
