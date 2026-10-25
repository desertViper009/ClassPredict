# ADR-003: Dataset Schema, Validation Rules & Pseudonymization Policy

> **Status**: Accepted (Amended with Mandatory Corrections)  
> **Date**: October 2026  
> **Scope**: Data Ingestion, Cross-Semester Linking & Privacy

---

## 1. Context

University academic records are legally protected personal data. Typical university grade sheets include student names, registration IDs, department codes, course titles, credit weights, and phone numbers. Storing or processing this excess metadata creates massive privacy liabilities and violates the Principle of Data Minimization.

Furthermore, student trajectories span multiple semesters (3 to 7 semesters). To form valid consecutive transitions $(s_t \to s_{t+1})$, records must be reliably linked to the same student over time without exposing their real-world identity.

---

## 2. Alternatives Considered

* **Complex Institutional Schema**: Ingesting names, roll numbers, and course codes. Rejected: Massive privacy liability and institution-specific dependencies.
* **Row-Order Inference Across Semesters**: Assuming that row 5 on a Semester 1 marksheet belongs to the same student as row 5 on a Semester 2 marksheet. Rejected: Highly dangerous and inaccurate. Student cohorts shift, drop out, or re-order between semesters.
* **Independent Key Generation per Sheet**: Generating a new key (`S1_001`, `S2_001`) on each imported sheet. Rejected: Destroys cross-semester identity linkage, making transition modeling impossible.
* **Stable Long-Format Pseudonymous Keys with Key Reconciliation (SELECTED)**:
  - Long-format CSV using consistent pseudonymous keys: `student_key,semester_no,sgpa`.
  - For separately imported result sheets, the user must explicitly verify/map rows to existing pseudonymous keys.

---

## 3. Decision

1. **Adopt Long-Format Minimalist Schema**:
   - `student_key` (String, regex `^[A-Za-z0-9_-]{1,32}$`).
   - `semester_no` (Positive integer, $1 \le \text{sem} \le 12$).
   - `sgpa` (Float, $0.00 \le \text{sgpa} \le 4.00$).
2. **Stable Pseudonymous Key Enforcement**: A student must retain the identical `student_key` across all semesters.
3. **Prohibition of Row-Order Inference**: The system strictly forbids automatically assigning keys based on OCR row position across separate sheets. An explicit key reconciliation mapping step is required.
4. **Immediate PII Stripping**: Extra columns (`name`, `email`, `roll_no`) are stripped during ingestion.
5. **Enforce Non-Bridging Rule**: Non-consecutive semester leaps (e.g., $s_1 \to s_3$) are strictly discarded from consecutive transition modeling.
6. **Acknowledge Pseudonymization vs. Anonymization**: Explicitly document that pseudonymization replaces direct identifiers with surrogate keys, but remains personal data subject to linkability risks.

---

## 4. Consequences & Trade-offs

* **Positive**: Minimalist data footprint; secure multi-semester linking; zero PII leakage risk; simple verification.
* **Negative**: Requires human verification during OCR key reconciliation.
