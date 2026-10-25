# Architectural Decision Records (ADR) Index — ClassPredict

> **Document ID**: DOC-ADR-INDEX  
> **Status**: Approved (Phase 1 Baseline)  
> **Lifecycle State**: Designed  
> **Last Updated**: October 2026

---

## 1. Architectural Decision Framework

ClassPredict maintains an immutable, version-controlled Architectural Decision Record (ADR) log to capture key architectural, numerical, privacy, and technology decisions.

Each ADR follows a standardized structure:
* **Status**: `Proposed` | `Accepted` | `Superseded` | `Deprecated`
* **Context**: Technical and academic constraints motivating the decision
* **Alternatives Considered**: Viable technical options evaluated
* **Decision**: Selected strategy and implementation direction
* **Rationale**: Justification grounded in numerical analysis, privacy, and simplicity
* **Trade-offs & Consequences**: Positive benefits and accepted liabilities

---

## 2. ADR Registry

| ADR ID | Title | Status | Date Accepted | Primary Focus | Authoritative Document |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADR-001** | Selection of Client-Side Web Architecture (HTML5/Vanilla CSS/ES6) | `Accepted` | October 2026 | Technology Stack & Runtime | [ADR-001.md](adr/ADR-001-technology-stack.md) |
| **ADR-002** | Numerical Formulation: Persistence Benchmark, Normal Equations & Pivoting | `Accepted` | October 2026 | Numerical Methods & Solvers | [ADR-002.md](adr/ADR-002-model-selection.md) |
| **ADR-003** | Minimalist CSV Schema & Strict Pseudonymization Policy | `Accepted` | October 2026 | Data Ingestion & Privacy | [ADR-003.md](adr/ADR-003-dataset-schema.md) |
| **ADR-004** | Privacy-Preserving OCR Cropping & Mandatory Human Verification Gate | `Accepted` | October 2026 | Document Processing & Ethics | [ADR-004.md](adr/ADR-004-ocr-and-privacy-workflow.md) |
| **ADR-005** | Ephemeral In-Memory State vs. Persistent Server Database | `Accepted` | October 2026 | Data Lifecycle & Security | [ADR-005.md](adr/ADR-005-persistence-vs-session-only-data.md) |
| **ADR-006** | Rolling-Origin Temporal Cross-Validation vs. Random Splitting | `Accepted` | October 2026 | Model Validation & Leakage | [ADR-006.md](adr/ADR-006-validation-strategy.md) |

---

## 3. Modifying & Creating ADRs

* When a major architectural decision is re-evaluated, author a new record (e.g., `ADR-007`).
* Do not overwrite past accepted ADRs; update their status to `Superseded` with a link to the superseding record.
