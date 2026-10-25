# Requirements Traceability Matrix — ClassPredict

> **Document ID**: DOC-TRC-001  
> **Status**: Approved & Verified (Phase 10 Production Deployment & Hardening Complete)  
> **Lifecycle State**: Deployed & Verified (Production Release, Service Worker, Educational Lab, Analytical Dashboard, OCR Ingestion, Prediction Workflows, Evaluation Engine, Numerical Core & Dataset Active)  
> **Last Updated**: October 2026

---

## 1. Traceability Framework & Lifecycle Status

This matrix tracks the realization of every functional (FR) and non-functional (NFR) requirement from design through implementation and verification.

### Status Definitions:
* **Planned**: Requirement defined and prioritized in `REQUIREMENTS.md`.
* **Designed**: Mathematical formulation, data schemas, and UI specifications completed in `/docs`.
* **Implemented**: Production source code authored in `/js/` or `/css/`.
* **Tested**: Automated unit, integration, or UI test executed and verified in `/tests/`.
* **Verified**: Benchmarked against empirical criteria (e.g., persistence baseline).
* **Deployed**: Live in static distribution environment.

---

## 2. Requirements to Design, Code & Test Mapping

| Req ID | Requirement Summary | Architectural Component | Implementation Files | Verification Test Cases | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-01** | Dashboard & Cohort Overview | Analytics & Presentation | `js/core/dashboard_analytics.js`, `js/ui/dashboard_view.js` | `test_dashboard.js` (`TC-DASH-01` to `TC-DASH-33`) | **`Tested` (Verified)** |
| **FR-02** | Dataset Management & Long-Format Schema | Core Services | `js/core/data_validator.js`, `js/services/state_manager.js` | `test_csv_parser.js` (Cases 1–20), `test_release_hardening.js` (`TC-REL-04`, `TC-REL-05`) | **`Tested` (Verified)** |
| **FR-03** | Individual Student Prediction & Out-of-Bounds Policy | Numerical Core, Service & UI | `js/core/regression_engine.js`, `js/services/prediction_service.js`, `js/ui/prediction_view.js` | `test_prediction.js` (Cases 1–12, 26), `test_release_hardening.js` (`TC-REL-06`, `TC-REL-07`) | **`Tested` (Verified)** |
| **FR-04** | Whole-Class Batch Prediction & Safe Export | Numerical Core, Service & UI | `js/services/prediction_service.js`, `js/ui/prediction_view.js` | `test_prediction.js` (Cases 13–25), `test_release_hardening.js` (`TC-REL-06`) | **`Tested` (Verified)** |
| **FR-05** | Privacy-Preserving OCR Ingestion & Key Reconciliation | Vision Services, Core & UI | `js/core/ocr_engine.js`, `js/services/ocr_service.js`, `js/ui/ocr_view.js` | `test_ocr.js` (`TC-OCR-01` to `TC-OCR-36`) | **`Tested` (Verified)** |
| **FR-06** | Manual CSV Import & Schema Filtering | Core Services & UI | `js/core/data_validator.js`, `js/ui/dataset_view.js` | `test_csv_parser.js` (Cases 1–6, 20), `test_release_hardening.js` (`TC-REL-04`) | **`Tested` (Verified)** |
| **FR-07** | Numerical Methods Laboratory | Educational Core & UI | `js/core/linear_algebra.js`, `js/core/numerical_lab.js`, `js/core/interpolation_engine.js`, `js/ui/numerical_lab_view.js` | `TC-NUM-01` to `TC-NUM-10`, `TC-INT-01` to `TC-INT-05`, `TC-LAB-01` to `TC-LAB-32` | **`Tested` (Verified)** |
| **FR-08** | Model Evaluation & Temporal Reporting| Numerical Core, Analytics & UI | `js/core/temporal_validator.js`, `js/core/dashboard_analytics.js`, `js/ui/dashboard_view.js` | `TC-VAL-01` to `TC-VAL-24`, `TC-DASH-18` to `TC-DASH-22` | **`Tested` (Verified)** |
| **NFR-01** | Numerical Stability & Scale-Aware Pivoting | Numerical Core | `js/core/linear_algebra.js`, `js/core/math_utils.js` | `test_linear_algebra.js`, `test_foundation.js`, `test_numerical_lab.js` | **`Tested` (Verified)** |
| **NFR-02** | Privacy & Zero Server Transmission | System Architecture | `js/core/data_validator.js`, `js/services/state_manager.js`, `js/services/prediction_service.js`, `js/services/ocr_service.js`, `js/core/ocr_engine.js`, `js/core/dashboard_analytics.js`, `js/core/numerical_lab.js`, `sw.js` | `test_csv_parser.js`, `test_prediction.js` (Cases 23-25), `test_ocr.js` (Cases 31-35), `test_dashboard.js` (Case 32), `test_numerical_lab.js` (Cases 30-31), `test_release_hardening.js` (`TC-REL-02`, `TC-REL-03`, `TC-REL-08`) | **`Tested` (Verified)** |
| **NFR-03** | Sub-50ms Parsing & Compute Performance | Core Services & Engine | `js/core/data_validator.js`, `js/services/prediction_service.js`, `js/core/ocr_engine.js`, `js/core/dashboard_analytics.js`, `js/core/numerical_lab.js` | Test runner benchmark (~60ms for 226 tests) | **`Tested` (Verified)** |
| **NFR-04** | Obsidian/Crimson Dark UI System | Presentation Layer | `css/main.css`, `css/components.css`, `index.html` | Visual verification, WCAG contrast compliance, responsive design | **`Tested` (Verified)** |
| **NFR-05** | Decoupled Testable Pure Core | System Architecture | `js/core/math_utils.js`, `js/core/linear_algebra.js`, `js/core/temporal_validator.js`, `js/services/prediction_service.js`, `js/core/ocr_engine.js`, `js/core/dashboard_analytics.js`, `js/core/numerical_lab.js` | Headless Node runner (226 passing tests across 40 suites) | **`Tested` (Verified)** |

---

## 3. Maintenance Protocol
* Whenever a developer authors code implementing a requirement, update the status to `Implemented`.
* When automated tests pass, update the status to `Tested`.
* Never declare a requirement `Tested` without verifiable test execution logs.

