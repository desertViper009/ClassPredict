/**
 * @file test_csv_parser.js
 * @description Comprehensive unit test suite for CSV parsing, schema validation, normalization, and state management.
 * Covers all 20 required Phase 3 verification cases.
 * Document Reference: docs/VALIDATION_AND_TESTING.md (TC-VAL-01 to TC-VAL-06)
 */

import { describe, it, assert, assertEqual, assertClose, assertThrows } from './test_runner.js';
import { parseCSV, validateAndNormalizeDataset, computeDatasetSummary } from '../js/core/data_validator.js';
import { StateManager } from '../js/services/state_manager.js';

export function loadDatasetTests() {
  describe("Phase 3: RFC-4180 CSV Parsing & Escaping", () => {
    it("Case 1: should parse standard valid CSV rows", () => {
      const csv = "student_key,semester_no,sgpa\nSTU_001,1,3.40\nSTU_001,2,3.60";
      const rows = parseCSV(csv);
      assertEqual(rows.length, 3, "Parsed row count must be 3 (1 header + 2 data)");
      assertEqual(rows[0][0], "student_key");
      assertEqual(rows[1][0], "STU_001");
      assertEqual(rows[1][1], "1");
      assertEqual(rows[1][2], "3.40");
      assertEqual(rows[2][2], "3.60");
    });

    it("Case 2: should handle quoted fields, commas inside quotes, and escaped quotes (\"\")", () => {
      const csv = 'student_key,semester_no,sgpa\n"STU_001",1,"3.50"\n"STU_""SPECIAL""_002",2,"3.85"';
      const rows = parseCSV(csv);
      assertEqual(rows.length, 3);
      assertEqual(rows[1][0], "STU_001");
      assertEqual(rows[1][2], "3.50");
      assertEqual(rows[2][0], 'STU_"SPECIAL"_002', "Escaped quotes must be unescaped to single quotes");
      assertEqual(rows[2][2], "3.85");
    });

    it("Case 3: should handle empty files and whitespace gracefully", () => {
      const emptyResult = parseCSV("");
      assertEqual(emptyResult.length, 0, "Empty string should return empty array");

      const whitespaceResult = parseCSV("   \n\r\n   ");
      assertEqual(whitespaceResult.length, 0, "Whitespace-only input should return empty array");

      const validation = validateAndNormalizeDataset([]);
      assert(validation.isValid === false, "Empty rows should be flagged invalid");
      assert(validation.errors[0].includes("empty"), "Error must mention file is empty");
    });

    it("Case 4: should reject header-only CSV", () => {
      const csv = "student_key,semester_no,sgpa\n";
      const rows = parseCSV(csv);
      assertEqual(rows.length, 1);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === false, "Header-only CSV must be rejected");
      assert(res.errors.some(e => e.includes("no data rows")), "Error must cite lack of data rows");
    });
  });

  describe("Phase 3: Schema & Privacy Guardrails", () => {
    it("Case 5: should reject files missing required columns", () => {
      const csv = "student_key,semester_no\nSTU_001,1";
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === false);
      assert(res.errors.some(e => e.includes("Missing required column(s): sgpa")));
    });

    it("Case 6: should reject unexpected personal-information columns to prevent privacy leaks", () => {
      const csv = "name,roll_no,student_key,semester_no,sgpa\nJohn Doe,101,STU_001,1,3.40";
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === false, "Unexpected PII headers must be rejected");
      assert(res.errors.some(e => e.includes("Unexpected column(s) detected: name, roll_no")));
      assert(res.errors.some(e => e.includes("Personal identifiers")), "Must explain privacy rationale");
    });
  });

  describe("Phase 3: Field-Level Validation", () => {
    it("Case 7: should reject empty or invalid student keys", () => {
      const csv = "student_key,semester_no,sgpa\n,1,3.50";
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === false);
      assert(res.errors.some(e => e.includes("Row 2: 'student_key' cannot be empty")));
    });

    it("Case 8: should reject invalid, fractional, negative, or zero semester numbers", () => {
      const csv = "student_key,semester_no,sgpa\nSTU_001,0,3.50\nSTU_002,-1,3.40\nSTU_003,2.5,3.20\nSTU_004,abc,3.10";
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === false);
      assert(res.errors.length >= 4, "All invalid semester entries must produce errors");
      assert(res.errors.some(e => e.includes("Row 2: 'semester_no' must be between 1 and 12")));
      assert(res.errors.some(e => e.includes("Row 3: 'semester_no' must be a positive integer")));
      assert(res.errors.some(e => e.includes("Row 4: 'semester_no' must be a positive integer")));
    });

    it("Case 9: should reject malformed SGPA values and unaccepted decimal commas", () => {
      const csv = "student_key,semester_no,sgpa\nSTU_001,1,3,45\nSTU_002,1,excellent";
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === false);
      assert(res.errors.some(e => e.includes("Row 2: Incorrect number of columns") || e.includes("Decimal commas are not supported")));
      assert(res.errors.some(e => e.includes("Row 3: 'sgpa' must be a valid finite number")));
    });

    it("Case 10: should reject SGPA values below 0.00 or above the configured scale maximum", () => {
      const csv = "student_key,semester_no,sgpa\nSTU_001,1,-0.15\nSTU_002,1,4.25";
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows, { scaleMax: 4.00 });
      assert(res.isValid === false);
      assert(res.errors.some(e => e.includes("Row 2: 'sgpa' is out of bounds")));
      assert(res.errors.some(e => e.includes("Row 3: 'sgpa' is out of bounds")));
    });

    it("Case 11: should reject NaN, Infinity, and non-numeric tokens", () => {
      const csv = "student_key,semester_no,sgpa\nSTU_001,1,NaN\nSTU_002,1,Infinity";
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === false);
      assert(res.errors.some(e => e.includes("Row 2: 'sgpa' must be a valid finite number")));
      assert(res.errors.some(e => e.includes("Row 3: 'sgpa' must be a valid finite number")));
    });

    it("Case 12: should detect duplicate (student_key, semester_no) records without exposing raw marks", () => {
      const csv = "student_key,semester_no,sgpa\nSTU_001,1,3.40\nSTU_001,1,3.65";
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === false);
      assert(res.errors.some(e => e.includes("Row 3: Duplicate record detected for semester 1")));
    });
  });

  describe("Phase 3: Multi-Student, Variable Horizons & Missing Semester Gaps", () => {
    it("Case 13: should support variable historical lengths (3 to 7 semesters)", () => {
      const csv = `student_key,semester_no,sgpa
STU_A,1,3.20
STU_A,2,3.30
STU_A,3,3.40
STU_B,1,2.80
STU_B,2,2.90
STU_B,3,3.00
STU_B,4,3.10
STU_B,5,3.20
STU_C,1,3.50
STU_C,2,3.60
STU_C,3,3.70
STU_C,4,3.80
STU_C,5,3.85
STU_C,6,3.90
STU_C,7,3.95`;
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === true, "Variable length dataset must be valid");
      assertEqual(res.summary.totalStudents, 3);
      assertEqual(res.summary.totalRecords, 15);
      assertEqual(res.summary.historyLengthDistribution[3], 1);
      assertEqual(res.summary.historyLengthDistribution[5], 1);
      assertEqual(res.summary.historyLengthDistribution[7], 1);
      assert(res.summary.hasIncompleteHistories === true, "Different history lengths flagged as incomplete horizons");
    });

    it("Case 14: should detect missing semester gaps and preserve actual numbers without bridging", () => {
      const csv = `student_key,semester_no,sgpa
STU_GAP,1,3.10
STU_GAP,2,3.20
STU_GAP,4,3.40`;
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === true);
      assertEqual(res.summary.studentsWithGaps.length, 1);
      assertEqual(res.summary.studentsWithGaps[0].fromSemester, 2);
      assertEqual(res.summary.studentsWithGaps[0].toSemester, 4);
      assertEqual(res.summary.studentsWithGaps[0].missingSemesters, 1);
      // Verify preserved actual semester numbers
      assertEqual(res.normalizedRecords[2].semester_no, 4, "Must preserve actual semester_no 4 without inventing semester 3");
    });

    it("Case 15: should handle cohorts with multiple students correctly", () => {
      const csv = `student_key,semester_no,sgpa
STU_001,1,3.50
STU_002,1,3.20
STU_003,1,3.80`;
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === true);
      assertEqual(res.summary.totalStudents, 3);
      assertEqual(res.summary.totalRecords, 3);
      assertEqual(res.summary.minSemester, 1);
      assertEqual(res.summary.maxSemester, 1);
    });

    it("Case 16: should sort normalized records deterministically by student_key and semester_no", () => {
      // Intentionally unsorted input
      const csv = `student_key,semester_no,sgpa
STU_002,2,3.10
STU_001,2,3.60
STU_002,1,3.00
STU_001,1,3.40`;
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === true);
      const records = res.normalizedRecords;
      assertEqual(records[0].student_key, "STU_001");
      assertEqual(records[0].semester_no, 1);
      assertEqual(records[1].student_key, "STU_001");
      assertEqual(records[1].semester_no, 2);
      assertEqual(records[2].student_key, "STU_002");
      assertEqual(records[2].semester_no, 1);
      assertEqual(records[3].student_key, "STU_002");
      assertEqual(records[3].semester_no, 2);
    });

    it("Case 17: should preserve stable pseudonymous keys across semester records", () => {
      const csv = `student_key,semester_no,sgpa
STU_PERSIST_01,1,3.40
STU_PERSIST_01,2,3.50
STU_PERSIST_01,3,3.60`;
      const rows = parseCSV(csv);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === true);
      for (const r of res.normalizedRecords) {
        assertEqual(r.student_key, "STU_PERSIST_01", "Key must be preserved identically across all records");
      }
    });
  });

  describe("Phase 3: State Management & In-Memory Isolation", () => {
    it("Case 18: should guarantee that an invalid import does NOT overwrite an accepted dataset", () => {
      const sm = new StateManager();
      
      // Step 1: Ingest valid dataset and accept it
      const validCsv = "student_key,semester_no,sgpa\nSTU_INIT,1,3.50\nSTU_INIT,2,3.60";
      const load1 = sm.loadCSV(validCsv);
      assert(load1.isValid === true);
      sm.acceptStagedDataset();
      
      const acceptedBefore = sm.getState().acceptedDataset;
      assertEqual(acceptedBefore.length, 2, "Accepted dataset should have 2 records");

      // Step 2: Attempt to load an invalid CSV
      const invalidCsv = "student_key,semester_no,sgpa\nSTU_BAD,1,9.99"; // Out of scale
      const load2 = sm.loadCSV(invalidCsv);
      assert(load2.isValid === false);

      const stateAfter = sm.getState();
      assertEqual(stateAfter.acceptedDataset.length, 2, "Accepted dataset MUST NOT be overwritten by failed import");
      assertEqual(stateAfter.acceptedDataset[0].student_key, "STU_INIT");
      assert(stateAfter.stagedErrors.length > 0, "Staged errors must reflect invalid file failure");
    });

    it("Case 19: should purge active dataset from memory upon discard or clear action", () => {
      const sm = new StateManager();
      const validCsv = "student_key,semester_no,sgpa\nSTU_DEL,1,3.50";
      sm.loadCSV(validCsv);
      sm.acceptStagedDataset();

      assert(sm.getState().acceptedDataset !== null);

      // Execute discard / clear
      sm.clearAcceptedDataset();

      const clearedState = sm.getState();
      assertEqual(clearedState.acceptedDataset, null, "Accepted dataset must be null after clear");
      assertEqual(clearedState.acceptedSummary, null, "Summary must be null after clear");
      assertEqual(clearedState.stagedDataset, null, "Staged dataset must be null after clear");
      assertEqual(clearedState.status, 'empty', "Status must revert to 'empty'");
    });

    it("Case 20: should ensure error messages do not expose raw student names or sensitive records", () => {
      // Ingest malformed line with name header
      const csvWithPii = "name,student_key,semester_no,sgpa\nSecretStudentName,STU_001,1,3.40";
      const rows = parseCSV(csvWithPii);
      const res = validateAndNormalizeDataset(rows);
      assert(res.isValid === false);

      const allErrorsText = res.errors.join(' ');
      // Must not leak the student's name into the error output
      assert(allErrorsText.includes("SecretStudentName") === false, "Error message must never print row values containing PII");
      assert(allErrorsText.includes("Unexpected column(s) detected: name"), "Must cite column name only");
    });
  });
}
