# Data Dictionary & Schema Specification — ClassPredict

> **Document ID**: DOC-DATA-001  
> **Status**: Approved & Implemented (Phase 3 Verified)  
> **Lifecycle State**: Implemented & Tested (Dataset Layer)  
> **Last Updated**: October 2026

---

## 1. Data Design Philosophy & Privacy Constraints

ClassPredict treats academic transcripts as sensitive personal records. To enforce privacy by design:
1. **Data Minimization**: Only the absolute minimum attributes required for numerical modeling are ingested: student identifier, semester index, and SGPA.
2. **Pseudonymization vs. Anonymization**: 
   - Identifiers must be pseudonymous keys (e.g., `STU_001`, `HASH_7A9B`).
   - *Academic Distinction*: Pseudonymization replaces direct identifiers (names, registration numbers) with an artificial surrogate key. It is **not** full anonymization: anyone possessing the original mapping or auxiliary context could re-identify a student. Therefore, pseudonymous datasets must still be handled responsibly.
3. **Strict Whitelist Schema Filtering**: Any uploaded CSV containing extraneous columns (such as `name`, `roll_no`, `phone`) is rejected at the parser boundary with an actionable error explaining that personal data must not enter the application.

---

## 2. Implemented Ingestion Schema & Validation Rules

### 2.1 Standard Long-Format CSV Schema (`data_validator.js`)

The dataset layer implements an RFC 4180 compliant CSV parser and schema validator.

| Field Name | Data Type | Permitted Values | Nullable? | Privacy Class | Implemented Validation & Normalization Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `student_key` | String | `^[A-Za-z0-9_-]{1,32}$` | No | Pseudonymous | Trimmed string. Non-empty. Must match regex pattern (1–32 alphanumeric, underscores, hyphens). Rejected if empty or containing invalid characters. |
| `semester_no` | Integer | $1 \le \text{sem} \le 12$ | No | Non-Sensitive | Positive integer string (`/^\d+$/`). Normalized via `parseInt(str, 10)`. Values $< 1$ or $> 12$ are rejected. |
| `sgpa` | Float | $0.00 \le \text{sgpa} \le 4.00$ | No | Sensitive Mark | Floating point number with dot notation. Decimal commas (e.g., `3,45`) are rejected with an explicit formatting message. Values $< 0.00$ or $> \text{scaleMax}$ (default 4.00) are rejected. |

#### RFC 4180 CSV Parsing Behavior:
* Quoted fields (`"value"`) are fully supported.
* Escaped double quotes (`""` inside quotes) are correctly unescaped to `"`.
* Embedded commas and newlines inside quoted fields are safely parsed.
* UTF-8 Byte Order Marks (BOM `\uFEFF`) are stripped automatically.
* Empty files, whitespace-only files, and header-only files are cleanly rejected.

#### Multi-Semester Linking & Key Consistency Rules:
* A student **must retain the identical `student_key` across their entire semester history** to establish valid longitudinal transitions $(s_t \to s_{t+1})$.
* In long-format CSV files, multiple rows share the same `student_key` with increasing `semester_no` (e.g., `SYN_001,1,3.45`, `SYN_001,2,3.52`, `SYN_001,3,3.60`).
* **Duplicate Detection**: Multiple entries for the same `(student_key, semester_no)` pair are flagged and rejected with the exact row number.
* **Deterministic Normalization**: Records are deterministically sorted primarily by `student_key` ascending, and secondarily by `semester_no` ascending.

---

## 3. Implemented Intermediate & Summary Data Structures

### 3.1 Dataset Summary Entity (`computeDatasetSummary`)
Returned by `js/core/data_validator.js` after successful normalization:

```typescript
interface DatasetSummary {
  totalStudents: number;             // Count of unique student_keys
  totalRecords: number;              // Total valid observation rows
  minSemester: number;               // Lowest observed semester_no (e.g., 1)
  maxSemester: number;               // Highest observed semester_no (e.g., 7)
  historyLengthDistribution: {       // Count of students per history horizon
    [semCount: number]: number;      // e.g., { "3": 10, "4": 25, "5": 15 }
  };
  studentsWithGaps: Array<{          // Students with non-consecutive semesters
    student_key: string;
    fromSemester: number;
    toSemester: number;
    missingSemesters: number;
  }>;
  hasIncompleteHistories: boolean;   // True if variable lengths or gaps present
  studentKeys: string[];             // Ordered list of unique student keys
}
```

> [!IMPORTANT]
> **Non-Bridging Policy**: If a student possesses records for Semester 1 and Semester 3, but is missing Semester 2, the dataset layer preserves the actual semester indices (`1` and `3`). It **never** manufactures an artificial Semester 2 or bridges the gap into a fake one-semester transition.

---

### 3.2 In-Memory Session State (`state_manager.js`)

The application state manager preserves in-memory isolation and prevents data corruption:

```typescript
interface AppState {
  scaleMax: number;                  // Default 4.00
  acceptedDataset: Record[] | null;  // Active confirmed cohort records
  acceptedSummary: DatasetSummary | null;
  stagedDataset: Record[] | null;    // Newly uploaded file awaiting confirmation
  stagedSummary: DatasetSummary | null;
  stagedErrors: string[];            // Parsing / validation error list
  status: 'empty' | 'staged' | 'accepted' | 'error';
}
```

* **Staging Protection**: An invalid CSV upload sets `stagedErrors` but **never overwrites or clears an already accepted dataset**.
* **Memory Purge**: Clicking `Discard Dataset from Memory` completely wipes `acceptedDataset` and `stagedDataset` from the browser heap.

---

### 3.3 OCR Candidate & Key Reconciliation Entities (Phase 7 Active)

Extracted by `js/core/ocr_engine.js` and managed by `js/services/ocr_service.js`:

```typescript
interface OcrCandidateRow {
  cropSequence: number;         // 1-based vertical line sequence within crop
  rawText: string;              // Exact recognized text line from Tesseract
  extractedSgpa: string | null; // Parsed numeric string (e.g. "3.45")
  proposedFix: string | null;   // Proposed decimal fix (e.g. "376" -> "3.76")
  confidence: number;           // OCR engine confidence score (0.0 to 100.0)
  status: 'VALID' | 'DECIMAL_AMBIGUOUS' | 'AMBIGUOUS' | 'OUT_OF_SCALE' | 'LOW_CONFIDENCE' | 'UNREADABLE' | 'INVALID';
  warnings: string[];           // Actionable review warnings
  assignedKey: string | null;   // Reconciled stable pseudonymous student key
  isNewStudent: boolean;        // True if creating a new cohort member
}

interface ReconciledRecord {
  student_key: string;          // Validated pseudonymous key
  semester_no: number;          // Target semester for the marksheet
  sgpa: number;                 // Verified float grade in [0.00, 4.00]
  cropSequence: number;
  isExistingStudent: boolean;
  isNewStudent: boolean;
}
```

#### Stable Key Persistence Rules across Multiple Semester Marksheets:
* **Cohort Linkage**: When importing a Semester 2 marksheet, rows must be mapped to existing Semester 1 keys (`SYN_001`, `SYN_002`, etc.) to form valid consecutive transitions.
* **No Positional Matching**: Student identities are never assumed from row order across sheets.
* **Canonical Export**: The full combined cohort can be exported as a long-format CSV, enabling preservation of verified keys across browser sessions without remote database storage.

---

## 4. Synthetic Data Labeling Policy

* Demonstration datasets (such as [`samples/sample_class_sgpa.csv`](../samples/sample_class_sgpa.csv)) are explicitly tagged with comment headers and use synthetic identifiers (`SYN_001` through `SYN_013`).
* Synthetic records must never be represented as empirical university records or used to claim real-world model accuracy.
