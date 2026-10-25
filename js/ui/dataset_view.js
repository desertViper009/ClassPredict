/**
 * @file dataset_view.js
 * @description Presentation layer component for Phase 3 CSV Import, Validation, Preview, and In-Memory State.
 * Renders the reactive dataset management interface adhering to Obsidian & Crimson design tokens.
 * Document Reference: docs/UI_UX_DESIGN.md, docs/USER_GUIDE.md
 */

import { stateManager } from '../services/state_manager.js';

export class DatasetView {
  /**
   * @param {HTMLElement} container - DOM container element
   */
  constructor(container) {
    this.container = container;
    this.unsubscribe = null;
  }

  /**
   * Initializes the view and subscribes to state manager changes.
   */
  init() {
    this.render();
    this.unsubscribe = stateManager.subscribe(() => {
      this.render();
    });
  }

  /**
   * Cleans up listeners when leaving view.
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Renders the complete dataset management workspace.
   */
  render() {
    const state = stateManager.getState();
    const hasAccepted = state.acceptedDataset && state.acceptedDataset.length > 0;
    const hasStaged = state.stagedDataset && state.stagedDataset.length > 0;
    const hasErrors = state.stagedErrors && state.stagedErrors.length > 0;

    this.container.innerHTML = `
      <div class="cp-page-stack">
        <div class="card cp-panel" style="margin-bottom: var(--space-xl);">
          <div class="card-header cp-panel-header">
            <div>
              <span class="cp-kicker">Data Foundation</span>
              <h2 class="card-title">Dataset Management &amp; Ingestion Layer</h2>
              <p class="card-subtitle">Import, validate, and inspect historical SGPA datasets (Phase 3)</p>
            </div>
            <div>
              ${hasAccepted 
                ? '<span class="badge badge-success cp-badge cp-badge-success">● Dataset Active in Session Memory</span>' 
                : '<span class="badge badge-synthetic cp-badge cp-badge-info">No Dataset Accepted</span>'}
            </div>
          </div>

          <!-- Schema Guidance Banner -->
          <div style="background-color: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-lg);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-sm);">
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">
                  Required Long-Format CSV Schema:
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                  Only three columns are permitted: <code style="color: var(--text-code);">student_key,semester_no,sgpa</code>.
                  Personal identifiers (names, roll numbers, contact details) are rejected to enforce data privacy.
                </div>
              </div>
              <button class="btn btn-secondary cp-button cp-button-secondary" id="btn-load-sample" style="font-size: 12px; padding: 6px 12px;">
                Load Synthetic Sample
              </button>
            </div>
            <div class="code-block" style="margin-top: 10px;">
student_key,semester_no,sgpa<br>
SYN_001,1,3.45<br>
SYN_001,2,3.52<br>
SYN_002,1,2.80
            </div>
          </div>

          <!-- File Ingestion Dropzone -->
          <div class="dropzone cp-dropzone" id="csv-dropzone">
            <input type="file" id="csv-file-input" accept=".csv" title="Upload long-format CSV dataset">
            <div class="dropzone-icon cp-dropzone-icon">📥</div>
            <div class="dropzone-title" style="font-weight: 700; font-size: 15px;">Select or Drag &amp; Drop Long-Format CSV</div>
            <div class="dropzone-subtitle" style="color: var(--cp-text-muted); font-size: 12px;">UTF-8 encoded CSV • Evaluated client-side • Zero server upload</div>
            <button class="btn btn-pill-crimson cp-button cp-button-primary" type="button" style="pointer-events: none; margin-top: 8px;">Browse Files ↗</button>
          </div>
        </div>

        <!-- Error Diagnostics Container -->
        ${hasErrors ? this.renderErrorAlert(state.stagedErrors, hasAccepted) : ''}

        <!-- Staged Dataset Confirmation Card -->
        ${hasStaged ? this.renderStagedConfirmation(state.stagedDataset, state.stagedSummary) : ''}

        <!-- Active Accepted Dataset Overview -->
        ${hasAccepted ? this.renderAcceptedOverview(state.acceptedDataset, state.acceptedSummary) : this.renderEmptyState(hasStaged, hasErrors)}
      </div>
    `;

    this.bindEvents();
  }

  /**
   * Renders error diagnostic alert box without exposing PII.
   */
  renderErrorAlert(errors, hasAcceptedBackup) {
    const backupNotice = hasAcceptedBackup 
      ? `<p style="margin-top: 8px; font-size: 13px; font-weight: 500; color: var(--text-primary);">
           🛡️ Note: Your previously accepted dataset remains completely safe in session memory.
         </p>` 
      : '';

    return `
      <div class="alert alert-error">
        <h4>Validation Failed (${errors.length} issue${errors.length > 1 ? 's' : ''} detected)</h4>
        <ul>
          ${errors.map(err => `<li>${this.escapeHtml(err)}</li>`).join('')}
        </ul>
        ${backupNotice}
        <div style="margin-top: 12px;">
          <button class="btn btn-secondary" id="btn-dismiss-errors" style="font-size: 12px; padding: 4px 10px;">Dismiss Error</button>
        </div>
      </div>
    `;
  }

  /**
   * Renders staged confirmation card prior to explicit acceptance.
   */
  renderStagedConfirmation(records, summary) {
    return `
      <div class="card" style="margin-bottom: var(--space-xl); border-color: var(--accent-warning);">
        <div class="card-header">
          <div>
            <h3 class="card-title" style="color: var(--accent-warning);">Staged Dataset Ready for Confirmation</h3>
            <p class="card-subtitle">Review normalized records and summary statistics before committing to active session memory</p>
          </div>
          <span class="badge badge-warning">Awaiting User Confirmation</span>
        </div>

        ${this.renderSummaryKPIs(summary)}

        <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: var(--space-md);">
          Normalized Dataset Preview (First 10 Records):
        </div>
        ${this.renderRecordsTable(records.slice(0, 10))}

        <div class="action-bar">
          <button class="btn btn-pill-white" id="btn-confirm-accept">
            <span class="btn-arrow-icon">↘</span> Confirm & Accept Dataset into Memory
          </button>
          <button class="btn btn-secondary" id="btn-discard-staged" style="border-radius: var(--radius-pill); padding: 10px 20px;">
            Discard Staged File
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renders active accepted dataset metrics and actions.
   */
  renderAcceptedOverview(records, summary) {
    return `
      <div class="card" style="margin-bottom: var(--space-xl); border-color: rgba(16, 185, 129, 0.3);">
        <div class="card-header">
          <div>
            <h3 class="card-title" style="color: var(--accent-success);">Active Cohort Dataset</h3>
            <p class="card-subtitle">Loaded into client volatile memory • Ready for numerical modeling</p>
          </div>
          <button class="btn btn-secondary" id="btn-clear-accepted" style="font-size: 12px; color: #EF4444; border-color: rgba(239, 68, 68, 0.3);">
            Discard Dataset from Memory
          </button>
        </div>

        ${this.renderSummaryKPIs(summary)}

        <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: var(--space-md); display: flex; justify-content: space-between; align-items: center;">
          <span>Validated Records Table (Showing ${Math.min(15, records.length)} of ${records.length}):</span>
          <span style="font-size: 12px; color: var(--text-tertiary);">Sorted by student_key, semester_no</span>
        </div>
        ${this.renderRecordsTable(records.slice(0, 15))}
      </div>
    `;
  }

  /**
   * Renders KPI cards for dataset summaries.
   */
  renderSummaryKPIs(summary) {
    if (!summary) return '';

    const gapsNotice = summary.studentsWithGaps && summary.studentsWithGaps.length > 0
      ? `<div style="margin-top: 12px; padding: 8px 12px; background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); font-size: 12px; color: var(--accent-warning);">
           ⚠️ Notice: ${summary.studentsWithGaps.length} student record(s) contain missing semester gaps (e.g. Semesters 1 and 3 present without Semester 2). Non-bridging rules will strictly preserve actual semester indices.
         </div>`
      : '';

    const horizonKeys = Object.keys(summary.historyLengthDistribution || {}).sort((a, b) => Number(a) - Number(b));
    const horizonStr = horizonKeys.map(k => `${k} sems: ${summary.historyLengthDistribution[k]}`).join(' • ');

    return `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Students</div>
          <div class="kpi-value">${summary.totalStudents}</div>
          <div class="kpi-meta">Unique pseudonymous keys</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Semester Records</div>
          <div class="kpi-value">${summary.totalRecords}</div>
          <div class="kpi-meta">Total observations</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Observed Span</div>
          <div class="kpi-value">${summary.minSemester ?? '-'} – ${summary.maxSemester ?? '-'}</div>
          <div class="kpi-meta">Semester range</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Horizon Diversity</div>
          <div class="kpi-value" style="font-size: 16px; margin-top: 8px;">${horizonStr || 'Uniform'}</div>
          <div class="kpi-meta">${summary.hasIncompleteHistories ? 'Variable horizons present' : 'Complete uniform cohort'}</div>
        </div>
      </div>
      ${gapsNotice}
    `;
  }

  /**
   * Renders tabular preview of normalized 3-column records.
   */
  renderRecordsTable(records) {
    if (!records || records.length === 0) {
      return '<p style="color: var(--text-tertiary); font-size: 13px; margin-top: 8px;">No records to display.</p>';
    }

    return `
      <div class="table-wrapper cp-table-scroll">
        <table class="data-table cp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Student Key</th>
              <th>Semester No</th>
              <th>Observed SGPA</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r, i) => `
              <tr>
                <td style="color: var(--text-tertiary);">${i + 1}</td>
                <td><span class="badge" style="background-color: var(--bg-card-hover); color: var(--text-primary); border: 1px solid var(--border-subtle);">${this.escapeHtml(r.student_key)}</span></td>
                <td>Semester ${r.semester_no}</td>
                <td style="font-weight: 600; color: #F8FAFC;">${r.sgpa.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Renders initial empty state when no dataset is loaded.
   */
  renderEmptyState(hasStaged, hasErrors) {
    if (hasStaged || hasErrors) return '';

    return `
      <div class="card" style="text-align: center; padding: var(--space-2xl) var(--space-lg); border-style: dashed;">
        <div style="font-size: 36px; margin-bottom: var(--space-sm);">📊</div>
        <h3 class="card-title" style="margin-bottom: var(--space-xs);">No Dataset Active in Memory</h3>
        <p style="color: var(--text-secondary); max-width: 520px; margin: 0 auto var(--space-lg) auto; font-size: 13px;">
          Upload a long-format CSV file or click "Load Synthetic Sample" above to inspect, validate, and stage academic records. All records remain 100% client-side in volatile memory.
        </p>
      </div>
    `;
  }

  /**
   * Binds user interaction event listeners.
   */
  bindEvents() {
    const fileInput = this.container.querySelector('#csv-file-input');
    const dropzone = this.container.querySelector('#csv-dropzone');
    const btnLoadSample = this.container.querySelector('#btn-load-sample');
    const btnConfirmAccept = this.container.querySelector('#btn-confirm-accept');
    const btnDiscardStaged = this.container.querySelector('#btn-discard-staged');
    const btnClearAccepted = this.container.querySelector('#btn-clear-accepted');
    const btnDismissErrors = this.container.querySelector('#btn-dismiss-errors');

    // File Input Change
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          this.readFile(file);
        }
      });
    }

    // Drag and Drop
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt && dt.files && dt.files[0];
        if (file) {
          this.readFile(file);
        }
      });
    }

    // Load Synthetic Sample
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', async () => {
        try {
          const resp = await fetch('samples/sample_class_sgpa.csv');
          if (!resp.ok) {
            throw new Error(`Failed to load sample dataset: HTTP ${resp.status}`);
          }
          const csvText = await resp.text();
          stateManager.loadCSV(csvText);
        } catch (err) {
          alert(`Error loading sample dataset: ${err.message}`);
        }
      });
    }

    // Confirm & Accept Staged Dataset
    if (btnConfirmAccept) {
      btnConfirmAccept.addEventListener('click', () => {
        stateManager.acceptStagedDataset();
      });
    }

    // Discard Staged Dataset
    if (btnDiscardStaged) {
      btnDiscardStaged.addEventListener('click', () => {
        stateManager.discardStagedDataset();
      });
    }

    // Clear Accepted Dataset
    if (btnClearAccepted) {
      btnClearAccepted.addEventListener('click', () => {
        if (confirm("Are you sure you want to discard this dataset from browser memory? All loaded student records will be purged.")) {
          stateManager.clearAcceptedDataset();
        }
      });
    }

    // Dismiss Errors
    if (btnDismissErrors) {
      btnDismissErrors.addEventListener('click', () => {
        stateManager.discardStagedDataset();
      });
    }
  }

  /**
   * Reads file contents using client FileReader.
   */
  readFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert("Invalid file format. Please select a .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      stateManager.loadCSV(text);
    };
    reader.onerror = () => {
      alert("Failed to read the selected file.");
    };
    reader.readAsText(file, 'UTF-8');
  }

  /**
   * Sanitizes string for safe HTML rendering to prevent XSS.
   */
  escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
