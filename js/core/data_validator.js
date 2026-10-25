/**
 * @file data_validator.js
 * @description RFC-4180 compliant CSV parser, schema validator, normalizer, and dataset summary engine.
 * Pure mathematical and data transformation core decoupled completely from the DOM.
 * Document Reference: docs/DATA_DICTIONARY.md, docs/REQUIREMENTS.md (FR-02, FR-06)
 */

export const DEFAULT_SCALE_MAX = 4.00;
export const ALLOWED_COLUMNS = ['student_key', 'semester_no', 'sgpa'];

/**
 * RFC 4180 compliant CSV parser.
 * Supports quoted fields, escaped quotes (""), embedded commas, and embedded newlines.
 * 
 * @param {string} text - Raw CSV text
 * @returns {string[][]} 2D array of parsed rows and columns
 * @throws {Error} If CSV syntax is malformed (e.g. unclosed quote)
 */
export function parseCSV(text) {
  if (typeof text !== 'string') {
    throw new Error("Invalid input: CSV text must be a string.");
  }

  // Strip UTF-8 Byte Order Mark (BOM) if present
  let input = text;
  if (input.charCodeAt(0) === 0xFEFF) {
    input = input.slice(1);
  }

  // If text is empty or only whitespace, return empty array
  if (input.trim() === '') {
    return [];
  }

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let quoteStartLine = 1;
  let currentLine = 1;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (char === '\n') {
      currentLine++;
    }

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++; // skip next quote
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        // Field opening quote
        if (currentField.length > 0 && currentField.trim().length > 0) {
          throw new Error(`Malformed CSV: Unexpected quote inside unquoted field on line ${currentLine}.`);
        }
        inQuotes = true;
        quoteStartLine = currentLine;
      } else if (char === ',') {
        // Field delimiter
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        // Carriage return: check if followed by newline
        if (nextChar === '\n') {
          i++; // consume \n
          currentLine++;
        }
        currentRow.push(currentField);
        currentField = '';
        // Only push non-empty row or if row has multiple empty fields
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else if (char === '\n') {
        // Newline record delimiter
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (inQuotes) {
    throw new Error(`Malformed CSV: Unclosed quote detected starting on line ${quoteStartLine}.`);
  }

  // Push remaining field and row if any
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Validates and normalizes raw CSV rows against the long-format schema.
 * Rejects unexpected columns to safeguard student privacy.
 * 
 * @param {string[][]} rows - Parsed 2D array of rows
 * @param {object} [options]
 * @param {number} [options.scaleMax=DEFAULT_SCALE_MAX] - Maximum allowable SGPA
 * @param {string[]} [options.allowedColumns=ALLOWED_COLUMNS] - Whitelisted headers
 * @returns {ValidationResult}
 */
export function validateAndNormalizeDataset(rows, options = {}) {
  const scaleMax = typeof options.scaleMax === 'number' ? options.scaleMax : DEFAULT_SCALE_MAX;
  const allowedCols = Array.isArray(options.allowedColumns) ? options.allowedColumns : ALLOWED_COLUMNS;

  const errors = [];

  // Filter out comments (e.g. metadata or documentation lines starting with '#')
  const nonCommentRows = Array.isArray(rows) 
    ? rows.filter(r => r.length > 0 && !(r[0] && r[0].trim().startsWith('#')))
    : [];

  // Check 1: Empty file
  if (nonCommentRows.length === 0) {
    return {
      isValid: false,
      errors: ["File is empty. Expected CSV with header: student_key,semester_no,sgpa."],
      normalizedRecords: [],
      summary: null
    };
  }

  // Parse headers (Row 0 of non-comment rows)
  const rawHeaders = nonCommentRows[0].map(h => h.trim());
  const normalizedHeaders = rawHeaders.map(h => h.toLowerCase());

  // Check 2: Missing required columns
  const missingCols = allowedCols.filter(col => !normalizedHeaders.includes(col));
  if (missingCols.length > 0) {
    errors.push(`Missing required column(s): ${missingCols.join(', ')}. Required schema: ${allowedCols.join(',')}.`);
  }

  // Check 3: Unexpected personal information columns
  const unexpectedCols = normalizedHeaders.filter(col => !allowedCols.includes(col));
  if (unexpectedCols.length > 0) {
    errors.push(
      `Unexpected column(s) detected: ${unexpectedCols.join(', ')}. ` +
      `For student privacy and data security, only '${allowedCols.join(', ')}' are permitted. ` +
      `Personal identifiers (such as names, roll numbers, or contact details) must be removed prior to upload.`
    );
  }

  // Check 4: Header only, no data rows
  if (nonCommentRows.length === 1) {
    errors.push("Dataset contains headers but no data rows.");
  }

  // If header-level errors exist, fail fast
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      normalizedRecords: [],
      summary: null
    };
  }

  const keyIndex = normalizedHeaders.indexOf('student_key');
  const semIndex = normalizedHeaders.indexOf('semester_no');
  const sgpaIndex = normalizedHeaders.indexOf('sgpa');

  const seenCombinations = new Set();
  const normalizedRecords = [];

  // Data rows validation (Rows 1 to N of non-comment rows)
  for (let r = 1; r < nonCommentRows.length; r++) {
    const row = nonCommentRows[r];
    const rowNum = r + 1; // 1-indexed line number in CSV

    // Row width check
    if (row.length !== rawHeaders.length) {
      errors.push(`Row ${rowNum}: Incorrect number of columns (expected ${rawHeaders.length}, found ${row.length}).`);
      continue;
    }

    const rawKey = row[keyIndex] ? row[keyIndex].trim() : '';
    const rawSem = row[semIndex] ? row[semIndex].trim() : '';
    const rawSgpa = row[sgpaIndex] ? row[sgpaIndex].trim() : '';

    let rowValid = true;

    // Field 1: student_key validation
    if (rawKey === '') {
      errors.push(`Row ${rowNum}: 'student_key' cannot be empty.`);
      rowValid = false;
    } else if (!/^[A-Za-z0-9_-]{1,32}$/.test(rawKey)) {
      errors.push(`Row ${rowNum}: 'student_key' contains invalid characters. Must be 1-32 alphanumeric characters, hyphens, or underscores.`);
      rowValid = false;
    }

    // Field 2: semester_no validation
    let semNo = null;
    if (rawSem === '') {
      errors.push(`Row ${rowNum}: 'semester_no' cannot be empty.`);
      rowValid = false;
    } else if (!/^\d+$/.test(rawSem)) {
      errors.push(`Row ${rowNum}: 'semester_no' must be a positive integer (e.g., 1, 2, 3).`);
      rowValid = false;
    } else {
      semNo = parseInt(rawSem, 10);
      if (semNo < 1 || semNo > 12) {
        errors.push(`Row ${rowNum}: 'semester_no' must be between 1 and 12.`);
        rowValid = false;
      }
    }

    // Field 3: sgpa validation
    let sgpaVal = null;
    if (rawSgpa === '') {
      errors.push(`Row ${rowNum}: 'sgpa' cannot be empty.`);
      rowValid = false;
    } else if (rawSgpa.includes(',')) {
      errors.push(`Row ${rowNum}: Invalid SGPA decimal format. Decimal commas are not supported; use standard dot notation (e.g., 3.45).`);
      rowValid = false;
    } else {
      sgpaVal = Number(rawSgpa);
      if (!Number.isFinite(sgpaVal) || Number.isNaN(sgpaVal)) {
        errors.push(`Row ${rowNum}: 'sgpa' must be a valid finite number.`);
        rowValid = false;
      } else if (sgpaVal < 0.00 || sgpaVal > scaleMax) {
        errors.push(`Row ${rowNum}: 'sgpa' is out of bounds. Must be between 0.00 and ${scaleMax.toFixed(2)}.`);
        rowValid = false;
      }
    }

    // Field 4: Duplicate (student_key, semester_no) check
    if (rowValid) {
      const comboKey = `${rawKey}#${semNo}`;
      if (seenCombinations.has(comboKey)) {
        errors.push(`Row ${rowNum}: Duplicate record detected for semester ${semNo}. Each student can have at most one record per semester.`);
        rowValid = false;
      } else {
        seenCombinations.add(comboKey);
      }
    }

    if (rowValid) {
      normalizedRecords.push({
        student_key: rawKey,
        semester_no: semNo,
        sgpa: Math.round(sgpaVal * 1000) / 1000 // preserve 3 decimal places
      });
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      normalizedRecords: [],
      summary: null
    };
  }

  // Normalization: Deterministic sort by student_key ASC, then semester_no ASC
  normalizedRecords.sort((a, b) => {
    const keyComp = a.student_key.localeCompare(b.student_key);
    if (keyComp !== 0) return keyComp;
    return a.semester_no - b.semester_no;
  });

  const summary = computeDatasetSummary(normalizedRecords);

  return {
    isValid: true,
    errors: [],
    normalizedRecords,
    summary
  };
}

/**
 * Computes descriptive statistics, student horizons, and missing semester gaps.
 * Preserves actual semester numbers without manufacturing transitions.
 * 
 * @param {Array<{student_key: string, semester_no: number, sgpa: number}>} records 
 * @returns {object} Summary statistics
 */
export function computeDatasetSummary(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      totalStudents: 0,
      totalRecords: 0,
      minSemester: null,
      maxSemester: null,
      historyLengthDistribution: {},
      studentsWithGaps: [],
      hasIncompleteHistories: false,
      studentKeys: []
    };
  }

  const studentMap = new Map();
  let minSem = Infinity;
  let maxSem = -Infinity;

  for (const r of records) {
    if (!studentMap.has(r.student_key)) {
      studentMap.set(r.student_key, []);
    }
    studentMap.get(r.student_key).push(r.semester_no);
    if (r.semester_no < minSem) minSem = r.semester_no;
    if (r.semester_no > maxSem) maxSem = r.semester_no;
  }

  const historyLengthDist = {};
  const studentsWithGaps = [];
  let maxHistoryLength = 0;
  let minHistoryLength = Infinity;

  studentMap.forEach((semesters, key) => {
    const count = semesters.length;
    historyLengthDist[count] = (historyLengthDist[count] || 0) + 1;
    if (count > maxHistoryLength) maxHistoryLength = count;
    if (count < minHistoryLength) minHistoryLength = count;

    // Check for gaps (non-consecutive semesters)
    for (let i = 0; i < semesters.length - 1; i++) {
      if (semesters[i + 1] - semesters[i] > 1) {
        studentsWithGaps.push({
          student_key: key,
          fromSemester: semesters[i],
          toSemester: semesters[i + 1],
          missingSemesters: semesters[i + 1] - semesters[i] - 1
        });
      }
    }
  });

  const hasIncompleteHistories = (minHistoryLength !== maxHistoryLength) || (studentsWithGaps.length > 0);

  return {
    totalStudents: studentMap.size,
    totalRecords: records.length,
    minSemester: minSem,
    maxSemester: maxSem,
    historyLengthDistribution: historyLengthDist,
    studentsWithGaps,
    hasIncompleteHistories,
    studentKeys: Array.from(studentMap.keys())
  };
}
