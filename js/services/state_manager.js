/**
 * @file state_manager.js
 * @description Centralized in-memory reactive state manager for Gradivue.
 * Enforces session ephemerality, staging workflows, and dataset integrity.
 * Document Reference: docs/ARCHITECTURE.md, docs/adr/ADR-005-persistence-vs-session-only-data.md
 */

import { parseCSV, validateAndNormalizeDataset, DEFAULT_SCALE_MAX, ALLOWED_COLUMNS } from '../core/data_validator.js';

class StateManager {
  constructor() {
    this.state = {
      scaleMax: DEFAULT_SCALE_MAX,
      acceptedDataset: null,
      acceptedSummary: null,
      stagedDataset: null,
      stagedSummary: null,
      stagedErrors: [],
      status: 'empty' // 'empty' | 'staged' | 'accepted' | 'error'
    };

    this.listeners = new Set();
  }

  /**
   * Returns a snapshot of the current state.
   * @returns {object}
   */
  getState() {
    return {
      scaleMax: this.state.scaleMax,
      acceptedDataset: this.state.acceptedDataset ? [...this.state.acceptedDataset] : null,
      acceptedSummary: this.state.acceptedSummary ? { ...this.state.acceptedSummary } : null,
      stagedDataset: this.state.stagedDataset ? [...this.state.stagedDataset] : null,
      stagedSummary: this.state.stagedSummary ? { ...this.state.stagedSummary } : null,
      stagedErrors: [...this.state.stagedErrors],
      status: this.state.status
    };
  }

  /**
   * Ingests and validates CSV text into the staging buffer.
   * Does NOT overwrite the accepted dataset, even if validation fails.
   * 
   * @param {string} csvText 
   * @returns {object} Validation result
   */
  loadCSV(csvText) {
    let rows;
    try {
      rows = parseCSV(csvText);
    } catch (parseError) {
      this.state.stagedDataset = null;
      this.state.stagedSummary = null;
      this.state.stagedErrors = [parseError.message];
      this.state.status = this.state.acceptedDataset ? 'accepted' : 'error';
      this.notify();
      return {
        isValid: false,
        errors: [parseError.message],
        normalizedRecords: [],
        summary: null
      };
    }

    const result = validateAndNormalizeDataset(rows, { scaleMax: this.state.scaleMax });

    if (result.isValid) {
      this.state.stagedDataset = result.normalizedRecords;
      this.state.stagedSummary = result.summary;
      this.state.stagedErrors = [];
      this.state.status = 'staged';
    } else {
      this.state.stagedDataset = null;
      this.state.stagedSummary = null;
      this.state.stagedErrors = result.errors;
      // Retain 'accepted' status if a valid dataset was previously accepted
      this.state.status = this.state.acceptedDataset ? 'accepted' : 'error';
    }

    this.notify();
    return result;
  }

  /**
   * Confirms and promotes the staged dataset into the active accepted dataset.
   * @returns {boolean} True if accepted successfully
   */
  acceptStagedDataset() {
    if (!this.state.stagedDataset) {
      return false;
    }

    this.state.acceptedDataset = this.state.stagedDataset;
    this.state.acceptedSummary = this.state.stagedSummary;
    this.state.stagedDataset = null;
    this.state.stagedSummary = null;
    this.state.stagedErrors = [];
    this.state.status = 'accepted';

    this.notify();
    return true;
  }

  /**
   * Atomically commits reviewed and reconciled OCR records into the accepted dataset.
   * Runs the full validateAndNormalizeDataset pipeline over the combined dataset.
   * If validation fails, preserves the existing accepted dataset unchanged.
   * 
   * @param {Array<object>} reconciledRows - Validated records { student_key, semester_no, sgpa }
   * @returns {{ success: boolean, errors: string[], summary: object | null }}
   */
  commitReconciledRecords(reconciledRows) {
    if (!Array.isArray(reconciledRows) || reconciledRows.length === 0) {
      return {
        success: false,
        errors: ["No reconciled records provided for commitment."],
        summary: null
      };
    }

    const currentAccepted = this.state.acceptedDataset || [];
    const combinedRows = [
      ALLOWED_COLUMNS,
      ...currentAccepted.map(r => [String(r.student_key), String(r.semester_no), Number(r.sgpa).toFixed(2)]),
      ...reconciledRows.map(r => [String(r.student_key), String(r.semester_no), Number(r.sgpa).toFixed(2)])
    ];

    const result = validateAndNormalizeDataset(combinedRows, { scaleMax: this.state.scaleMax });

    if (result.isValid) {
      this.state.acceptedDataset = result.normalizedRecords;
      this.state.acceptedSummary = result.summary;
      this.state.stagedDataset = null;
      this.state.stagedSummary = null;
      this.state.stagedErrors = [];
      this.state.status = 'accepted';
      this.notify();
      return {
        success: true,
        errors: [],
        summary: result.summary
      };
    } else {
      // Preserve accepted dataset unchanged!
      return {
        success: false,
        errors: result.errors,
        summary: null
      };
    }
  }

  /**
   * Discards any currently staged records without affecting the accepted dataset.
   */
  discardStagedDataset() {
    this.state.stagedDataset = null;
    this.state.stagedSummary = null;
    this.state.stagedErrors = [];
    this.state.status = this.state.acceptedDataset ? 'accepted' : 'empty';
    this.notify();
  }

  /**
   * Completely purges the active accepted dataset and all staging buffers from memory.
   */
  clearAcceptedDataset() {
    this.state.acceptedDataset = null;
    this.state.acceptedSummary = null;
    this.state.stagedDataset = null;
    this.state.stagedSummary = null;
    this.state.stagedErrors = [];
    this.state.status = 'empty';
    this.notify();
  }

  /**
   * Updates the configured SGPA scale maximum.
   * @param {number} scaleMax 
   */
  setScaleMax(scaleMax) {
    if (typeof scaleMax === 'number' && scaleMax > 0) {
      this.state.scaleMax = scaleMax;
      this.notify();
    }
  }

  /**
   * Subscribes a listener to state transitions.
   * @param {Function} listener 
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emits state update to all registered listeners.
   */
  notify() {
    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (err) {
        console.error("StateManager listener error:", err);
      }
    });
  }
}

// Export singleton instance and class
export const stateManager = new StateManager();
export { StateManager };
