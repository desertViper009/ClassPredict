/**
 * @file ocr_engine.js
 * @description Pure numerical, geometric, candidate-parsing, and key-reconciliation engine
 * for Phase 7 Privacy-Preserving OCR Ingestion. Completely decoupled from the DOM.
 * Document Reference: docs/REQUIREMENTS.md (FR-05), docs/adr/ADR-004-ocr-and-privacy-workflow.md
 */

import { DEFAULT_SCALE_MAX, ALLOWED_COLUMNS } from './data_validator.js';
export { DEFAULT_SCALE_MAX, ALLOWED_COLUMNS };

// Document validation boundaries
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const SUPPORTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf'
];
export const SUPPORTED_FILE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];

export const OCR_CONFIDENCE_THRESHOLD = 60.0; // Minimum acceptable OCR confidence percentage

/**
 * Validates document metadata before decoding.
 * 
 * @param {object} fileMeta - { name: string, size: number, type?: string }
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validateDocumentFile(fileMeta) {
  if (!fileMeta || typeof fileMeta !== 'object') {
    return { isValid: false, error: "No document file provided." };
  }

  const name = typeof fileMeta.name === 'string' ? fileMeta.name.toLowerCase() : '';
  const size = typeof fileMeta.size === 'number' ? fileMeta.size : 0;
  const type = typeof fileMeta.type === 'string' ? fileMeta.type.toLowerCase() : '';

  if (size <= 0) {
    return { isValid: false, error: "Document file is empty (0 bytes)." };
  }

  if (size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (size / (1024 * 1024)).toFixed(1);
    const maxMb = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return {
      isValid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed threshold of ${maxMb} MB.`
    };
  }

  const hasSupportedExt = SUPPORTED_FILE_EXTENSIONS.some(ext => name.endsWith(ext));
  const hasSupportedMime = type === '' || SUPPORTED_MIME_TYPES.includes(type);

  if (!hasSupportedExt || !hasSupportedMime) {
    return {
      isValid: false,
      error: `Unsupported file format. Supported formats are: ${SUPPORTED_FILE_EXTENSIONS.join(', ')}.`
    };
  }

  return { isValid: true, error: null };
}

/**
 * Transforms crop coordinates from display canvas coordinates to natural image/PDF coordinates,
 * taking into account aspect ratios, CSS scaling, and rotation (0°, 90°, 180°, 270°).
 * 
 * @param {object} displayCrop - { x: number, y: number, width: number, height: number }
 * @param {object} displayDim - { width: number, height: number }
 * @param {object} naturalDim - { width: number, height: number }
 * @param {number} [rotation=0] - Rotation angle in degrees (0, 90, 180, 270)
 * @returns {object} { x: number, y: number, width: number, height: number } in natural pixels
 */
export function transformCropCoordinates(displayCrop, displayDim, naturalDim, rotation = 0) {
  if (!displayCrop || !displayDim || !naturalDim) {
    throw new Error("Invalid parameters for crop coordinate transformation.");
  }

  const { x, y, width, height } = displayCrop;
  const { width: dispW, height: dispH } = displayDim;
  const { width: natW, height: natH } = naturalDim;

  if (dispW <= 0 || dispH <= 0 || natW <= 0 || natH <= 0) {
    throw new Error("Display and natural dimensions must be positive non-zero numbers.");
  }

  // Bound display crop to display dimensions
  const clampedX = Math.max(0, Math.min(x, dispW));
  const clampedY = Math.max(0, Math.min(y, dispH));
  const clampedW = Math.max(0, Math.min(width, dispW - clampedX));
  const clampedH = Math.max(0, Math.min(height, dispH - clampedY));

  // Base scale factors (unrotated)
  const scaleX = natW / dispW;
  const scaleY = natH / dispH;

  const normX = clampedX / dispW;
  const normY = clampedY / dispH;
  const normW = clampedW / dispW;
  const normH = clampedH / dispH;

  const normRot = ((rotation % 360) + 360) % 360;

  let finalX, finalY, finalW, finalH;

  switch (normRot) {
    case 90:
      finalX = normY * natW;
      finalY = (1.0 - (normX + normW)) * natH;
      finalW = normH * natW;
      finalH = normW * natH;
      break;
    case 180:
      finalX = (1.0 - (normX + normW)) * natW;
      finalY = (1.0 - (normY + normH)) * natH;
      finalW = normW * natW;
      finalH = normH * natH;
      break;
    case 270:
      finalX = (1.0 - (normY + normH)) * natW;
      finalY = normX * natH;
      finalW = normH * natW;
      finalH = normW * natH;
      break;
    case 0:
    default:
      finalX = normX * natW;
      finalY = normY * natH;
      finalW = normW * natW;
      finalH = normH * natH;
      break;
  }

  return {
    x: Math.round(finalX),
    y: Math.round(finalY),
    width: Math.round(finalW),
    height: Math.round(finalH)
  };
}

/**
 * Parses raw OCR text into candidate SGPA values with ambiguity and confidence detection.
 * Strictly adheres to academic integrity rules:
 * - Does NOT replace unreadable values with zero.
 * - Does NOT silently correct ambiguous decimals without human-review flags.
 * - Does NOT treat row order as student identity.
 * 
 * @param {string} rawOcrText 
 * @param {object} [options]
 * @param {number} [options.scaleMax=DEFAULT_SCALE_MAX]
 * @param {number} [options.confidenceThreshold=OCR_CONFIDENCE_THRESHOLD]
 * @param {Array<{text: string, confidence: number}>} [options.lineTokens] - Optional line tokens with OCR confidence
 * @returns {Array<object>} Candidate rows
 */
export function extractSgpaCandidatesFromText(rawOcrText, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : DEFAULT_SCALE_MAX;
  const confThreshold = typeof options.confidenceThreshold === 'number' 
    ? options.confidenceThreshold 
    : OCR_CONFIDENCE_THRESHOLD;

  if (typeof rawOcrText !== 'string' || rawOcrText.trim() === '') {
    return [];
  }

  const rawLines = rawOcrText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const candidates = [];

  for (let i = 0; i < rawLines.length; i++) {
    const lineText = rawLines[i];
    const tokenMeta = options.lineTokens && options.lineTokens[i] ? options.lineTokens[i] : null;
    const confidence = tokenMeta && typeof tokenMeta.confidence === 'number' ? tokenMeta.confidence : 85.0;

    // Detect numeric candidates:
    // Regex matches valid decimals (e.g. "3.45", "3.0", "4.00") or 3-4 digit integers ("345", "376")
    const cleanNumbers = lineText.match(/\b\d+(?:\.\d+)?\b/g) || [];

    let extractedValue = null;
    let proposedFix = null;
    let status = 'VALID';
    const warnings = [];

    if (cleanNumbers.length === 0) {
      status = 'UNREADABLE';
      warnings.push("No numeric value recognized on line.");
    } else if (cleanNumbers.length > 1) {
      status = 'AMBIGUOUS';
      warnings.push(`Multiple numeric candidates detected on row: [${cleanNumbers.join(', ')}]. Manual review required.`);
      extractedValue = cleanNumbers[0];
    } else {
      const numStr = cleanNumbers[0];

      if (numStr.includes('.')) {
        const val = parseFloat(numStr);
        if (!Number.isFinite(val)) {
          status = 'INVALID';
          warnings.push("Extracted non-finite number.");
        } else if (val < 0.00 || val > scaleMax) {
          status = 'OUT_OF_SCALE';
          warnings.push(`SGPA ${val.toFixed(2)} is outside scale [0.00, ${scaleMax.toFixed(2)}].`);
          extractedValue = numStr;
        } else {
          extractedValue = val.toFixed(2);
          status = 'VALID';
        }
      } else {
        // Integer without decimal point (e.g. "376" -> proposed 3.76)
        if (numStr.length >= 2 && numStr.length <= 4) {
          const intVal = parseInt(numStr, 10);
          const proposed = (intVal / Math.pow(10, numStr.length - 1)).toFixed(2);
          status = 'DECIMAL_AMBIGUOUS';
          proposedFix = proposed;
          extractedValue = numStr;
          warnings.push(`Decimal point missing in "${numStr}". Proposed: ${proposed} (Requires explicit human verification).`);
        } else {
          status = 'INVALID';
          warnings.push(`Unrecognized numeric pattern: "${numStr}".`);
          extractedValue = numStr;
        }
      }
    }

    if (confidence < confThreshold) {
      if (status === 'VALID') status = 'LOW_CONFIDENCE';
      warnings.push(`Low OCR confidence (${confidence.toFixed(1)}% < ${confThreshold}%).`);
    }

    candidates.push({
      cropSequence: i + 1,
      rawText: lineText,
      extractedSgpa: extractedValue,
      proposedFix: proposedFix,
      confidence: confidence,
      status: status,
      warnings: warnings,
      assignedKey: null,
      isNewStudent: false
    });
  }

  return candidates;
}

/**
 * Reconciles student keys for candidate rows, ensuring stable keys and collision prevention.
 * 
 * Rules:
 * - A student must maintain the same pseudonymous student_key across semesters.
 * - Duplicate (student_key, semester_no) entries within the batch or against accepted dataset are rejected.
 * - Missing key assignment blocks confirmation.
 * - Row order is strictly detached from identity.
 * 
 * @param {Array<object>} candidates - Reviewed candidate rows
 * @param {Array<object>} acceptedDataset - Existing accepted records in session memory
 * @param {number} targetSemester - Target semester number for this marksheet (1-12)
 * @returns {{ isValid: boolean, reconciledRows: Array<object>, errors: string[] }}
 */
export function reconcileStudentKeys(candidates, acceptedDataset = [], targetSemester) {
  const errors = [];
  const sem = Number(targetSemester);

  if (!Number.isInteger(sem) || sem < 1 || sem > 12) {
    errors.push(`Target semester must be an integer between 1 and 12 (received: ${targetSemester}).`);
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    errors.push("No candidate rows provided for reconciliation.");
    return { isValid: false, reconciledRows: [], errors };
  }

  // Set of existing (student_key, semester_no) in accepted dataset
  const existingKeySemCombos = new Set();
  const knownStudentKeys = new Set();

  if (Array.isArray(acceptedDataset)) {
    for (const record of acceptedDataset) {
      if (record && record.student_key) {
        existingKeySemCombos.add(`${record.student_key}__${record.semester_no}`);
        knownStudentKeys.add(record.student_key);
      }
    }
  }

  const batchKeySemCombos = new Set();
  const reconciledRows = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    const row = candidates[idx];
    const key = typeof row.assignedKey === 'string' ? row.assignedKey.trim() : '';

    if (!key) {
      errors.push(`Row #${row.cropSequence || idx + 1}: Missing student key. Every row must be explicitly mapped.`);
      continue;
    }

    // Key format validation
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(key)) {
      errors.push(`Row #${row.cropSequence || idx + 1}: Student key "${key}" contains invalid characters (allowed: alphanumeric, _, -; max 32 chars).`);
      continue;
    }

    // SGPA validation
    const sgpaVal = parseFloat(row.extractedSgpa);
    if (!Number.isFinite(sgpaVal) || sgpaVal < 0.00 || sgpaVal > DEFAULT_SCALE_MAX) {
      errors.push(`Row #${row.cropSequence || idx + 1}: SGPA "${row.extractedSgpa}" is invalid or out of scale [0.00, ${DEFAULT_SCALE_MAX.toFixed(2)}].`);
    }

    // Check 1: Duplicate within the current proposed import batch
    const comboKey = `${key}__${sem}`;
    if (batchKeySemCombos.has(comboKey)) {
      errors.push(`Row #${row.cropSequence || idx + 1}: Duplicate student key "${key}" assigned multiple times for Semester ${sem} in this import.`);
    }
    batchKeySemCombos.add(comboKey);

    // Check 2: Conflict with accepted dataset in memory
    if (existingKeySemCombos.has(comboKey)) {
      errors.push(`Row #${row.cropSequence || idx + 1}: Student key "${key}" already has an accepted record for Semester ${sem} in the active dataset.`);
    }

    const isKnown = knownStudentKeys.has(key);

    reconciledRows.push({
      student_key: key,
      semester_no: sem,
      sgpa: sgpaVal,
      cropSequence: row.cropSequence || idx + 1,
      isExistingStudent: isKnown,
      isNewStudent: !isKnown
    });
  }

  return {
    isValid: errors.length === 0,
    reconciledRows,
    errors
  };
}

/**
 * Builds candidate long-format CSV rows combining the accepted dataset with newly reconciled OCR rows.
 * This can be directly passed into `validateAndNormalizeDataset` for complete atomic verification.
 * 
 * @param {Array<object>} acceptedDataset 
 * @param {Array<object>} reconciledRows 
 * @returns {Array<Array<string>>} 2D array of rows formatted for validation
 */
export function buildCandidateImportDataset(acceptedDataset = [], reconciledRows = []) {
  const rows = [ALLOWED_COLUMNS];

  if (Array.isArray(acceptedDataset)) {
    for (const r of acceptedDataset) {
      rows.push([
        String(r.student_key),
        String(r.semester_no),
        Number(r.sgpa).toFixed(2)
      ]);
    }
  }

  if (Array.isArray(reconciledRows)) {
    for (const r of reconciledRows) {
      rows.push([
        String(r.student_key),
        String(r.semester_no),
        Number(r.sgpa).toFixed(2)
      ]);
    }
  }

  return rows;
}

/**
 * Generates an automatic pseudonymous student key that does not collide with existing keys.
 * 
 * @param {Set<string> | Array<string>} existingKeys 
 * @param {number} [indexHint=1] 
 * @returns {string} Unique pseudonymous key (e.g. "SYN_011")
 */
export function generateUniqueStudentKey(existingKeys, indexHint = 1) {
  const keySet = existingKeys instanceof Set ? existingKeys : new Set(existingKeys || []);
  let count = indexHint;
  while (true) {
    const candidate = `SYN_${String(count).padStart(3, '0')}`;
    if (!keySet.has(candidate)) {
      return candidate;
    }
    count++;
  }
}
