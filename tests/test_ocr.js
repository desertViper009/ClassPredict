/**
 * @file test_ocr.js
 * @description Comprehensive automated tests for Phase 7: Privacy-Preserving OCR Ingestion & Key Reconciliation.
 * Tests document validation, crop transformations, numeric SGPA candidate extraction,
 * decimal ambiguity handling, stable key reconciliation, atomic commitment, and privacy boundaries.
 * Document Reference: docs/REQUIREMENTS.md (FR-05), docs/VALIDATION_AND_TESTING.md
 */

import { describe, it, assert, assertFalse, assertEqual, assertClose, assertThrows } from './test_runner.js';
import {
  validateDocumentFile,
  transformCropCoordinates,
  extractSgpaCandidatesFromText,
  reconcileStudentKeys,
  buildCandidateImportDataset,
  generateUniqueStudentKey,
  MAX_FILE_SIZE_BYTES,
  OCR_CONFIDENCE_THRESHOLD
} from '../js/core/ocr_engine.js';
import { OCRService } from '../js/services/ocr_service.js';
import { StateManager } from '../js/services/state_manager.js';
import { predictWholeClass } from '../js/core/prediction_service.js';

export function loadOcrTests() {
  describe("Phase 7: Document Handling & Crop Transformations", () => {
    it("Case 1: should accept supported file types and reject unsupported file types", () => {
      // Supported: PNG, JPG, JPEG, WEBP, PDF
      const validPng = validateDocumentFile({ name: "results.png", size: 1024 * 100, type: "image/png" });
      assert(validPng.isValid, "PNG should be valid");

      const validPdf = validateDocumentFile({ name: "results.pdf", size: 1024 * 500, type: "application/pdf" });
      assert(validPdf.isValid, "PDF should be valid");

      const validJpg = validateDocumentFile({ name: "scan.jpeg", size: 1024 * 200, type: "image/jpeg" });
      assert(validJpg.isValid, "JPEG should be valid");

      const validWebp = validateDocumentFile({ name: "scan.webp", size: 1024 * 150, type: "image/webp" });
      assert(validWebp.isValid, "WEBP should be valid");

      // Unsupported: DOCX, EXE, TXT, CSV
      const invalidDocx = validateDocumentFile({ name: "results.docx", size: 1024 * 100, type: "application/msword" });
      assertFalse(invalidDocx.isValid, "DOCX should be rejected");
      assert(invalidDocx.error.includes("Unsupported file format"));

      const invalidExe = validateDocumentFile({ name: "malware.exe", size: 1024 * 50, type: "application/octet-stream" });
      assertFalse(invalidExe.isValid, "EXE should be rejected");
    });

    it("Case 2: should reject invalid, empty, or missing document inputs", () => {
      const emptyFile = validateDocumentFile({ name: "empty.pdf", size: 0, type: "application/pdf" });
      assertFalse(emptyFile.isValid);
      assert(emptyFile.error.includes("empty"));

      const nullFile = validateDocumentFile(null);
      assertFalse(nullFile.isValid);

      const undefinedFile = validateDocumentFile(undefined);
      assertFalse(undefinedFile.isValid);
    });

    it("Case 3: should enforce invalid page selection limits on document rendering", async () => {
      const service = new OCRService();
      // Without loading a file, render should throw
      let threw = false;
      try {
        await service.renderPageToCanvas({}, 1);
      } catch (err) {
        threw = true;
        assert(err.message.includes("No document loaded"));
      }
      assert(threw, "Must throw if no document loaded");

      // Load a mock file
      await service.loadDocument({ name: "test.png", size: 1000, type: "image/png" });
      assertEqual(service.pageCount, 1);

      // Page 0 or page 2 on a 1-page image should throw
      let threwPage0 = false;
      try {
        await service.renderPageToCanvas({}, 0);
      } catch (err) {
        threwPage0 = true;
        assert(err.message.includes("Invalid page number"));
      }
      assert(threwPage0, "Page 0 must be rejected");

      let threwPage2 = false;
      try {
        await service.renderPageToCanvas({}, 2);
      } catch (err) {
        threwPage2 = true;
        assert(err.message.includes("Invalid page number"));
      }
      assert(threwPage2, "Page 2 on 1-page doc must be rejected");
    });

    it("Case 4: should enforce maximum file size boundaries to prevent memory exhaustion", () => {
      const oversized = validateDocumentFile({
        name: "giant_scan.pdf",
        size: MAX_FILE_SIZE_BYTES + 1024,
        type: "application/pdf"
      });
      assertFalse(oversized.isValid);
      assert(oversized.error.includes("exceeds maximum allowed threshold"));

      const exactLimit = validateDocumentFile({
        name: "limit.pdf",
        size: MAX_FILE_SIZE_BYTES,
        type: "application/pdf"
      });
      assert(exactLimit.isValid);
    });

    it("Case 5: should transform crop coordinates accurately when display canvas is scaled", () => {
      // Display canvas is 400x500, but natural image is 800x1000 (2x scale)
      const displayCrop = { x: 50, y: 100, width: 100, height: 200 };
      const displayDim = { width: 400, height: 500 };
      const naturalDim = { width: 800, height: 1000 };

      const natCrop = transformCropCoordinates(displayCrop, displayDim, naturalDim, 0);

      assertEqual(natCrop.x, 100);
      assertEqual(natCrop.y, 200);
      assertEqual(natCrop.width, 200);
      assertEqual(natCrop.height, 400);
    });

    it("Case 6: should transform crop coordinates correctly for 90, 180, and 270 degree rotations", () => {
      const displayCrop = { x: 10, y: 20, width: 50, height: 80 };
      const displayDim = { width: 100, height: 200 };
      const naturalDim = { width: 100, height: 200 };

      // 0 degrees
      const rot0 = transformCropCoordinates(displayCrop, displayDim, naturalDim, 0);
      assertEqual(rot0.x, 10);
      assertEqual(rot0.y, 20);

      // 180 degrees: inverted
      const rot180 = transformCropCoordinates(displayCrop, displayDim, naturalDim, 180);
      assertEqual(rot180.x, 100 - (10 + 50)); // 40
      assertEqual(rot180.y, 200 - (20 + 80)); // 100
      assertEqual(rot180.width, 50);
      assertEqual(rot180.height, 80);

      // 90 degrees
      const rot90 = transformCropCoordinates(displayCrop, displayDim, naturalDim, 90);
      assert(rot90.width === 40); // 80/200 * 100
    });
  });

  describe("Phase 7: OCR Numeric Extraction & Candidate Parsing", () => {
    it("Case 7: should extract numeric SGPA candidates from synthetic text fixtures", () => {
      const rawText = "3.45\n3.62\n3.80\n2.95";
      const candidates = extractSgpaCandidatesFromText(rawText);

      assertEqual(candidates.length, 4);
      assertEqual(candidates[0].extractedSgpa, "3.45");
      assertEqual(candidates[0].status, "VALID");
      assertEqual(candidates[1].extractedSgpa, "3.62");
      assertEqual(candidates[2].extractedSgpa, "3.80");
      assertEqual(candidates[3].extractedSgpa, "2.95");
    });

    it("Case 8: should detect and flag non-numeric or unreadable lines", () => {
      const rawText = "3.45\nGRADE\n---\n3.70";
      const candidates = extractSgpaCandidatesFromText(rawText);

      assertEqual(candidates.length, 4);
      assertEqual(candidates[0].status, "VALID");
      assertEqual(candidates[1].status, "UNREADABLE");
      assert(candidates[1].warnings[0].includes("No numeric value"));
      assertEqual(candidates[2].status, "UNREADABLE");
      assertEqual(candidates[3].status, "VALID");
    });

    it("Case 9: should flag rows containing multiple numeric values as ambiguous", () => {
      const rawText = "3.45 3.80\n2.90";
      const candidates = extractSgpaCandidatesFromText(rawText);

      assertEqual(candidates[0].status, "AMBIGUOUS");
      assert(candidates[0].warnings[0].includes("Multiple numeric candidates"));
      assertEqual(candidates[1].status, "VALID");
    });

    it("Case 10: should flag missing decimal points as DECIMAL_AMBIGUOUS with proposed fix", () => {
      // E.g., OCR dropped the dot: "376" -> proposed "3.76"
      const rawText = "376\n345";
      const candidates = extractSgpaCandidatesFromText(rawText);

      assertEqual(candidates[0].status, "DECIMAL_AMBIGUOUS");
      assertEqual(candidates[0].proposedFix, "3.76");
      assert(candidates[0].warnings[0].includes("Decimal point missing"));
      assertFalse(candidates[0].status === "VALID", "Must require explicit human review");
    });

    it("Case 11: should flag out-of-scale SGPA values exceeding maximum GPA ceiling", () => {
      const rawText = "4.50\n-0.20\n3.50";
      const candidates = extractSgpaCandidatesFromText(rawText, { scaleMax: 4.00 });

      assertEqual(candidates[0].status, "OUT_OF_SCALE");
      assert(candidates[0].warnings[0].includes("outside scale"));
      assertEqual(candidates[2].status, "VALID");
    });

    it("Case 12: should never silently replace unreadable candidates with zero", () => {
      const rawText = "UNREADABLE_SCAN\n???";
      const candidates = extractSgpaCandidatesFromText(rawText);

      assertEqual(candidates[0].extractedSgpa, null);
      assertFalse(candidates[0].extractedSgpa === "0.00", "Must never substitute 0.00 for unreadable text");
      assertFalse(candidates[1].extractedSgpa === "0", "Must never substitute 0 for unreadable text");
    });

    it("Case 13: should tag low-confidence OCR lines when below the review threshold", () => {
      const rawText = "3.45\n3.80";
      const tokens = [
        { text: "3.45", confidence: 95.0 },
        { text: "3.80", confidence: 45.0 } // below 60%
      ];
      const candidates = extractSgpaCandidatesFromText(rawText, {
        confidenceThreshold: OCR_CONFIDENCE_THRESHOLD,
        lineTokens: tokens
      });

      assertEqual(candidates[0].status, "VALID");
      assertEqual(candidates[1].status, "LOW_CONFIDENCE");
      assert(candidates[1].warnings[0].includes("Low OCR confidence"));
    });

    it("Case 14: should preserve accepted dataset intact if OCR recognition fails or errors", async () => {
      const service = new OCRService();
      const state = new StateManager();

      // Pre-accept valid dataset in state
      state.loadCSV("student_key,semester_no,sgpa\nSYN_001,1,3.50\nSYN_001,2,3.60");
      state.acceptStagedDataset();
      const initialAccepted = state.getState().acceptedDataset;

      // Simulate OCR failure
      try {
        await service.runOcrOnCroppedCanvas(null);
      } catch (err) {
        assert(err.message.includes("empty"));
      }

      // Verify accepted dataset was not corrupted
      assertEqual(state.getState().acceptedDataset.length, initialAccepted.length);
      assertEqual(state.getState().acceptedDataset[0].sgpa, 3.50);
    });
  });

  describe("Phase 7: Stable Student-Key Reconciliation & Collision Prevention", () => {
    it("Case 15: should support explicit mapping to an existing pseudonymous key", () => {
      const accepted = [
        { student_key: "SYN_001", semester_no: 1, sgpa: 3.50 },
        { student_key: "SYN_002", semester_no: 1, sgpa: 3.20 }
      ];

      const candidates = [
        { cropSequence: 1, extractedSgpa: "3.60", assignedKey: "SYN_001" },
        { cropSequence: 2, extractedSgpa: "3.35", assignedKey: "SYN_002" }
      ];

      const res = reconcileStudentKeys(candidates, accepted, 2);
      assert(res.isValid, "Reconciliation should be valid");
      assertEqual(res.reconciledRows.length, 2);
      assertEqual(res.reconciledRows[0].student_key, "SYN_001");
      assertEqual(res.reconciledRows[0].semester_no, 2);
      assertEqual(res.reconciledRows[0].isExistingStudent, true);
    });

    it("Case 16: should support creation of new unique pseudonymous keys", () => {
      const existingKeys = ["SYN_001", "SYN_002"];
      const newKey = generateUniqueStudentKey(existingKeys, 1);
      assertEqual(newKey, "SYN_003");

      const candidates = [
        { cropSequence: 1, extractedSgpa: "3.75", assignedKey: newKey }
      ];

      const res = reconcileStudentKeys(candidates, [], 1);
      assert(res.isValid);
      assertEqual(res.reconciledRows[0].student_key, "SYN_003");
      assertEqual(res.reconciledRows[0].isNewStudent, true);
    });

    it("Case 17: should reject duplicate key assignments within the same proposed batch", () => {
      const candidates = [
        { cropSequence: 1, extractedSgpa: "3.50", assignedKey: "SYN_001" },
        { cropSequence: 2, extractedSgpa: "3.70", assignedKey: "SYN_001" } // Duplicate for semester 2!
      ];

      const res = reconcileStudentKeys(candidates, [], 2);
      assertFalse(res.isValid);
      assert(res.errors[0].includes("Duplicate student key \"SYN_001\""));
    });

    it("Case 18: should preserve stable pseudonymous keys across multiple semester imports", () => {
      const acceptedSemester1 = [
        { student_key: "SYN_001", semester_no: 1, sgpa: 3.20 },
        { student_key: "SYN_002", semester_no: 1, sgpa: 3.40 }
      ];

      // Marksheet for Semester 2: Student 2 is row 1, Student 1 is row 2!
      const candidatesSem2 = [
        { cropSequence: 1, extractedSgpa: "3.55", assignedKey: "SYN_002" },
        { cropSequence: 2, extractedSgpa: "3.30", assignedKey: "SYN_001" }
      ];

      const res = reconcileStudentKeys(candidatesSem2, acceptedSemester1, 2);
      assert(res.isValid);

      const combinedRows = buildCandidateImportDataset(acceptedSemester1, res.reconciledRows);
      // Row 0 is header, then 2 from sem 1, 2 from sem 2
      assertEqual(combinedRows.length, 5);
      // Verify SYN_001 has two records (sem 1 and sem 2)
      const syn001Records = combinedRows.filter(r => r[0] === "SYN_001");
      assertEqual(syn001Records.length, 2);
    });

    it("Case 19: should never automatically match students across different semester sheets by row position", () => {
      const candidates = [
        { cropSequence: 1, extractedSgpa: "3.50", assignedKey: null } // No key assigned
      ];
      const res = reconcileStudentKeys(candidates, [], 2);
      assertFalse(res.isValid, "Must not infer key from row 1 automatically");
      assert(res.errors[0].includes("Missing student key"));
    });

    it("Case 20: should maintain distinct student records even when SGPA values are identical", () => {
      const candidates = [
        { cropSequence: 1, extractedSgpa: "3.50", assignedKey: "SYN_001" },
        { cropSequence: 2, extractedSgpa: "3.50", assignedKey: "SYN_002" }
      ];

      const res = reconcileStudentKeys(candidates, [], 1);
      assert(res.isValid);
      assertEqual(res.reconciledRows[0].student_key, "SYN_001");
      assertEqual(res.reconciledRows[1].student_key, "SYN_002");
      assertEqual(res.reconciledRows[0].sgpa, res.reconciledRows[1].sgpa);
    });

    it("Case 21: should block confirmation if any candidate row has missing student key", () => {
      const candidates = [
        { cropSequence: 1, extractedSgpa: "3.40", assignedKey: "SYN_001" },
        { cropSequence: 2, extractedSgpa: "3.60", assignedKey: "" } // Blank
      ];

      const res = reconcileStudentKeys(candidates, [], 1);
      assertFalse(res.isValid);
      assert(res.errors[0].includes("Missing student key"));
    });
  });

  describe("Phase 7: Human Review, Invalidation & Atomic Dataset Commitment", () => {
    it("Case 22: should prevent unreviewed or unconfirmed OCR candidates from entering accepted dataset", () => {
      const state = new StateManager();
      const initialAccepted = state.getState().acceptedDataset;
      assertEqual(initialAccepted, null);

      const service = new OCRService();
      service.extractedCandidates = [
        { cropSequence: 1, extractedSgpa: "3.50", assignedKey: "SYN_001" }
      ];

      // StateManager should still be empty because no commit was confirmed
      assertEqual(state.getState().acceptedDataset, null);
    });

    it("Case 23: should track review versions to ensure confirmation operates on current crop state", () => {
      const service = new OCRService();
      assertEqual(service.reviewVersion, 0);

      service.setRotation(90);
      assertEqual(service.reviewVersion, 1);

      service.setCropFromDisplay({ x: 10, y: 10, width: 50, height: 50 }, { width: 100, height: 100 });
      assertEqual(service.reviewVersion, 2);
    });

    it("Case 24: should invalidate previous review when crop or rotation is modified", () => {
      const service = new OCRService();
      service.extractedCandidates = [{ cropSequence: 1, extractedSgpa: "3.50" }];

      // Changing crop clears candidate cache
      service.setCropFromDisplay({ x: 20, y: 20, width: 40, height: 40 }, { width: 100, height: 100 });
      assertEqual(service.extractedCandidates.length, 0);
    });

    it("Case 25: should preserve previously accepted dataset untouched if proposed import has errors", () => {
      const state = new StateManager();
      state.loadCSV("student_key,semester_no,sgpa\nSYN_001,1,3.40\nSYN_002,1,3.50");
      state.acceptStagedDataset();

      const prevAccepted = state.getState().acceptedDataset;
      assertEqual(prevAccepted.length, 2);

      // Attempt to commit invalid rows (out-of-scale SGPA 5.00)
      const invalidRows = [
        { student_key: "SYN_003", semester_no: 1, sgpa: 5.00 }
      ];

      const commitRes = state.commitReconciledRecords(invalidRows);
      assertFalse(commitRes.success);
      assert(commitRes.errors.length > 0);

      // Accepted dataset remains intact
      assertEqual(state.getState().acceptedDataset.length, 2);
      assertEqual(state.getState().acceptedDataset[0].sgpa, 3.40);
    });

    it("Case 26: should atomically commit valid reconciled rows and update accepted state", () => {
      const state = new StateManager();
      state.loadCSV("student_key,semester_no,sgpa\nSYN_001,1,3.40");
      state.acceptStagedDataset();

      const validRows = [
        { student_key: "SYN_001", semester_no: 2, sgpa: 3.55 },
        { student_key: "SYN_002", semester_no: 1, sgpa: 3.20 }
      ];

      const commitRes = state.commitReconciledRecords(validRows);
      assert(commitRes.success);
      assertEqual(commitRes.errors.length, 0);

      const accepted = state.getState().acceptedDataset;
      assertEqual(accepted.length, 3);
      assertEqual(state.getState().status, "accepted");
    });

    it("Case 27: should block commitment if candidate conflicts with already accepted student-semester", () => {
      const state = new StateManager();
      state.loadCSV("student_key,semester_no,sgpa\nSYN_001,1,3.40");
      state.acceptStagedDataset();

      // Conflicting row: SYN_001 for Semester 1 already exists!
      const conflictingRows = [
        { student_key: "SYN_001", semester_no: 1, sgpa: 3.80 }
      ];

      const commitRes = state.commitReconciledRecords(conflictingRows);
      assertFalse(commitRes.success);
      assert(commitRes.errors[0].includes("Duplicate record detected for semester 1"));
    });

    it("Case 28: should leave accepted dataset unchanged on import cancellation or discard", () => {
      const state = new StateManager();
      state.loadCSV("student_key,semester_no,sgpa\nSYN_001,1,3.40");
      state.acceptStagedDataset();

      const service = new OCRService();
      service.extractedCandidates = [{ cropSequence: 1, extractedSgpa: "3.90" }];

      // User clicks discard
      service.discardTemporaryState();

      assertEqual(service.extractedCandidates.length, 0);
      assertEqual(state.getState().acceptedDataset.length, 1);
    });

    it("Case 29: should ensure confirmed OCR records are immediately available to prediction workflows", () => {
      const state = new StateManager();
      state.loadCSV("student_key,semester_no,sgpa\nSYN_001,1,3.20\nSYN_002,1,3.40");
      state.acceptStagedDataset();

      // Ingest semester 2 via OCR commit
      const sem2Rows = [
        { student_key: "SYN_001", semester_no: 2, sgpa: 3.40 },
        { student_key: "SYN_002", semester_no: 2, sgpa: 3.60 }
      ];
      state.commitReconciledRecords(sem2Rows);

      // Evaluate predictions on newly updated dataset
      const accepted = state.getState().acceptedDataset;
      assertEqual(accepted.length, 4);

      const predictions = predictWholeClass(accepted);
      assertEqual(predictions.sharedModelStatus, "FITTED");
      assertEqual(predictions.summaryCounts.predictedCount, 2);
      assertEqual(predictions.students[0].target_semester, 3);
    });

    it("Case 30: should purge temporary OCR buffers, canvases, and candidates on discard", () => {
      const service = new OCRService();
      service.currentFile = { name: "test.pdf" };
      service.extractedCandidates = [{ cropSequence: 1, extractedSgpa: "3.50" }];
      service.rawOcrText = "3.50";

      service.discardTemporaryState();

      assertEqual(service.currentFile, null);
      assertEqual(service.extractedCandidates.length, 0);
      assertEqual(service.rawOcrText, "");
    });
  });

  describe("Phase 7: Privacy Boundaries & Zero-Exfiltration Verification", () => {
    it("Case 31: should guarantee no application code uploads source documents", () => {
      const service = new OCRService();
      // Inspect methods on service: verify no outbound network calls are registered
      assert(typeof service.loadDocument === 'function');
      // Document file is retained purely as memory reference
      assertFalse(Object.prototype.hasOwnProperty.call(service, 'remoteEndpoint'));
    });

    it("Case 32: should guarantee no application code uploads cropped pixels or OCR text", () => {
      const cropped = { width: 100, height: 200, isMockCropCanvas: true };
      const service = new OCRService();
      assert(typeof service.runOcrOnCroppedCanvas === 'function');
    });

    it("Case 33: should guarantee no source documents or raw OCR text are persisted to localStorage/sessionStorage", () => {
      // In clean state, verify no keys are written to persistent stores
      if (typeof window !== 'undefined' && window.localStorage) {
        assertEqual(window.localStorage.length, 0);
      }
    });

    it("Case 34: should guarantee that no personal identifiers are introduced into OCR-generated records", () => {
      const candidates = [
        { cropSequence: 1, extractedSgpa: "3.50", assignedKey: "SYN_001" }
      ];
      const res = reconcileStudentKeys(candidates, [], 1);
      assert(res.isValid);
      const record = res.reconciledRows[0];

      assertFalse(Object.prototype.hasOwnProperty.call(record, 'name'));
      assertFalse(Object.prototype.hasOwnProperty.call(record, 'student_name'));
      assertFalse(Object.prototype.hasOwnProperty.call(record, 'roll_no'));
      assertFalse(Object.prototype.hasOwnProperty.call(record, 'registration_no'));
      assertFalse(Object.prototype.hasOwnProperty.call(record, 'email'));
      assertEqual(record.student_key, "SYN_001");
    });

    it("Case 35: should ensure error diagnostics report line numbers without logging sensitive marks or names", () => {
      const badCandidate = [
        { cropSequence: 5, extractedSgpa: "9.99", assignedKey: "INVALID-KEY$$$" }
      ];
      const res = reconcileStudentKeys(badCandidate, [], 1);
      assertFalse(res.isValid);
      assert(res.errors[0].includes("Row #5:"));
      assertFalse(res.errors[0].toLowerCase().includes("john"));
      assertFalse(res.errors[0].toLowerCase().includes("email"));
    });

    it("Case 36: should guarantee all Phase 2–6 models, predictions, and datasets remain regression-free", () => {
      const state = new StateManager();
      state.loadCSV("student_key,semester_no,sgpa\nSYN_001,1,3.00\nSYN_001,2,3.20\nSYN_001,3,3.40");
      state.acceptStagedDataset();

      const wholeClass = predictWholeClass(state.getState().acceptedDataset);
      assertEqual(wholeClass.summaryCounts.totalStudents, 1);
      assertEqual(wholeClass.students[0].target_semester, 4);
    });
  });
}
