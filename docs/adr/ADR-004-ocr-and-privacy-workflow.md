# ADR-004: Privacy-Preserving OCR Cropping & Mandatory Human Verification Gate

> **Status**: Accepted (Amended with Mandatory Corrections)  
> **Date**: October 2026  
> **Scope**: Document Ingestion, Computer Vision & Data Ethics

---

## 1. Context

University result sheets contain full student names, registration numbers, photographs, and institutional watermarks. Sending an entire marksheet image into an OCR pipeline or cloud vision API presents extreme privacy risks and produces noisy token streams.

Furthermore, OCR accuracy on decimal grades is imperfect; misreading `3.08` as `308` or confusing `3.80` with `3.00` can severely distort numerical regression models.

---

## 2. Alternatives Considered

* **Full-Page Cloud OCR (Google Cloud Vision / AWS Textract)**: Highly accurate, but requires transmitting student records to third-party commercial cloud APIs. Rejected: severe privacy violation.
* **Automated Direct Ingestion**: Running OCR and automatically appending recognized numbers directly into the model training set without user confirmation. Rejected: single misrecognized decimal corrupts the regression slope.
* **Canvas Crop Boundary with Human-in-the-Loop Tabular Review (SELECTED)**:
  - User renders document locally on an HTML5 canvas via PDF.js.
  - User interactively draws a crop box around *only* the SGPA column.
  - Only the isolated cropped sub-bitmap is processed by a local WebAssembly Tesseract worker.
  - Extracted numbers populate an editable staging table with confidence scores.
  - For multi-semester sheets, keys must be reconciled explicitly (never inferred from row order).
  - No data enters the model dataset until the human auditor explicitly edits, validates, reconciles keys, and clicks `Confirm & Import`.

---

## 3. Decision

1. **Local Crop Enforcement**: OCR extraction is restricted strictly to the user-selected bounding box. Names, roll numbers, and personal details outside the box are never converted to image tokens or processed.
2. **In-Browser Execution & Asset Delivery**:
   - Use PDF.js for local PDF page rasterization and Tesseract.js inside a dedicated Web Worker.
   - Distinguish downloading static application assets (scripts, WASM binaries, `eng.traineddata`) from transmitting user records. Zero user records are ever transmitted outbound.
   - Prefer locally hosted assets in `/assets/` for offline capability; document CDN limitations (internet dependency for initial download).
3. **Mandatory Human-in-the-Loop Gate**: Candidates remain in an ephemeral review grid. Misrecognized values must be corrected, and missing rows can be added manually.
4. **Key Reconciliation (No Row-Order Assumption)**: The system strictly forbids assuming that row 1 on Semester 1 matches row 1 on Semester 2. Users must explicitly map candidates to stable pseudonymous keys.
5. **Zero Persistence**: Source images and raw OCR output are never uploaded to a backend or persisted by default.

---

## 4. Consequences & Trade-offs

* **Positive**: Absolute privacy protection; no PII exposure; human verification eliminates OCR calculation errors in regression training.
* **Negative**: Requires manual human effort to crop and audit candidate rows (an intentional and ethical trade-off).
