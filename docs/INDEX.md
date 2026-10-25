# Documentation Master Index — ClassPredict

> **Version**: 1.0.0 (Phase 10 Production Release Complete)  
> **Status**: Completed & Verified (All 10 Phases Implemented, Hardened & Deployed)  
> **Repository**: [https://github.com/desertViper009/ClassPredict](https://github.com/desertViper009/ClassPredict)  
> **Live Web Application**: [https://desertviper009.github.io/ClassPredict/](https://desertviper009.github.io/ClassPredict/)  
> **Last Updated**: October 2026  
> **Target Audience**: Students, Academic Evaluators, Peer Reviewers, Software Engineers

Welcome to the **ClassPredict** project documentation. This documentation system is organized to provide complete traceability, mathematical rigor, and architectural clarity for an undergraduate Computer Science and Engineering capstone in **Numerical Methods**.

---

## 1. Document Directory Navigation

| Document | Primary Focus | Target Audience | When to Consult |
| :--- | :--- | :--- | :--- |
| **[PROJECT_CHARTER.md](PROJECT_CHARTER.md)** | Mission, scope, constraints, and success criteria | Student, Supervisor | Beginning of project, scope audits |
| **[REQUIREMENTS.md](REQUIREMENTS.md)** | Functional (FR-01–FR-08) & Non-Functional specifications | Developers, QA | Feature planning, acceptance testing |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System topology, data flow, component breakdown | System Architects, Developers | System design, refactoring, code setup |
| **[DATA_DICTIONARY.md](DATA_DICTIONARY.md)** | Field definitions, long-format CSV schema, validation logic | Data Engineers, Developers | Data ingestion, file imports, error checks |
| **[NUMERICAL_MODEL.md](NUMERICAL_MODEL.md)** | Mathematics, scale-aware pivoting, centering, algorithms | Evaluators, Numerical Specialists | Oral defense, algorithm implementation |
| **[VALIDATION_AND_TESTING.md](VALIDATION_AND_TESTING.md)** | Temporal validation, backtesting, error metrics | QA, Academic Evaluators | Benchmarking, writing test suites |
| **[PRIVACY_SECURITY.md](PRIVACY_SECURITY.md)** | Data ethics, pseudonymization, key reconciliation | Security Reviewers, Evaluators | Privacy compliance, file handling |
| **[UI_UX_DESIGN.md](UI_UX_DESIGN.md)** | Design tokens, raw output display, warning cards | Frontend Engineers, Designers | UI styling, responsive layout checks |
| **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** | Coding conventions, toolchain, Git hygiene, Node testing | Developers, Contributors | Setting up dev environment, writing code |
| **[USER_GUIDE.md](USER_GUIDE.md)** | Step-by-step operational manual & local launch | End Users, Evaluators | Testing user workflows, uploading data |
| **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** | Local serving, asset delivery, static hosting procedures | DevOps, Deployment Leads | Running locally, hosting live demo |
| **[DEMO_PLAN.md](DEMO_PLAN.md)** | University viva script, test scenarios, defense Q&A | Presenter, Student | Viva presentation, portfolio recordings |
| **[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)** | Statistical bounds, sample size constraints, risks | All Stakeholders | Defending project constraints in viva |
| **[DECISIONS.md](DECISIONS.md)** | Architectural Decision Records (ADR) index | Architects, Reviewers | Reviewing why technical choices were made |
| **[TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md)** | Requirement-to-Test-to-Design cross-reference | QA, Project Manager | Verifying coverage and compliance |
| **[CHANGELOG.md](CHANGELOG.md)** | Chronological record of architectural modifications | All Stakeholders | Tracking changes across releases |

---

## 2. Architectural Decision Records (ADRs)

* **[ADR-001: Technology Stack Selection](adr/ADR-001-technology-stack.md)** — Decision to adopt a client-side architecture (HTML5/Vanilla CSS/ES6 JavaScript) for privacy and pedagogical clarity.
* **[ADR-002: Numerical Modeling & Algorithm Strategy](adr/ADR-002-model-selection.md)** — Scale-aware Gaussian elimination, predictor centering, degrees of freedom, and persistence fallback.
* **[ADR-003: Dataset Schema and Pseudonymization Policy](adr/ADR-003-dataset-schema.md)** — Long-format CSV schema (`student_key,semester_no,sgpa`), key consistency, and reconciliation.
* **[ADR-004: OCR Mark-Sheet Ingestion and Human-in-the-Loop Review](adr/ADR-004-ocr-and-privacy-workflow.md)** — Canvas crop boundaries, Web Worker OCR, asset downloading distinctions, and key reconciliation.
* **[ADR-005: Client-Side Ephemeral Session Storage](adr/ADR-005-persistence-vs-session-only-data.md)** — Retention of academic marks in volatile browser memory only.
* **[ADR-006: Rolling-Origin Temporal Validation](adr/ADR-006-validation-strategy.md)** — Expanding-window temporal evaluation to eliminate data leakage.
