/**
 * @file prediction_view.js
 * @description Presentation layer component for Phase 6 Prediction Workflows:
 * individual trajectory forecasting, whole-class cohort prediction,
 * model-status evaluation reporting, and privacy-preserving CSV export.
 * Document Reference: docs/UI_UX_DESIGN.md, docs/REQUIREMENTS.md (FR-03, FR-04)
 */

import { stateManager } from '../services/state_manager.js';
import { 
  predictIndividualStudent, 
  predictWholeClass, 
  exportWholeClassCSV, 
  exportIndividualCSV,
  PREDICTION_MODELS, 
  PREDICTION_STATUS 
} from '../core/prediction_service.js';

export class PredictionView {
  /**
   * @param {HTMLElement} container - DOM container element
   */
  constructor(container) {
    this.container = container;
    this.unsubscribe = null;

    // View state
    this.activeSubtab = 'individual'; // 'individual' | 'wholeClass'
    this.individualObservations = [
      { semester_no: 1, sgpa: 3.20 },
      { semester_no: 2, sgpa: 3.35 },
      { semester_no: 3, sgpa: 3.48 },
      { semester_no: 4, sgpa: 3.56 }
    ];
    this.selectedModel = PREDICTION_MODELS.INDIVIDUAL_TREND;
    this.individualResult = null;
    this.individualError = null;

    // Whole-class table state
    this.classFilterStatus = 'ALL';
    this.classSortColumn = 'student_key';
    this.classSortDirection = 'asc';
    this.classSearchQuery = '';

    // Cached whole-class prediction output
    this.wholeClassCache = null;
  }

  /**
   * Initializes view and subscribes to state manager.
   */
  init() {
    this.updateWholeClassPredictions();
    this.render();
    this.bindEvents();

    this.unsubscribe = stateManager.subscribe(() => {
      this.updateWholeClassPredictions();
      this.render();
      this.bindEvents();
    });
  }

  /**
   * Cleans up subscription on unmount.
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Evaluates or refreshes whole-class predictions against the active session dataset.
   */
  updateWholeClassPredictions() {
    const state = stateManager.getState();
    if (state.acceptedDataset && state.acceptedDataset.length > 0) {
      this.wholeClassCache = predictWholeClass(state.acceptedDataset, {
        scaleMax: state.scaleMax
      });
    } else {
      this.wholeClassCache = null;
    }
  }

  /**
   * Primary render method.
   */
  render() {
    const state = stateManager.getState();
    const hasAccepted = !!(state.acceptedDataset && state.acceptedDataset.length > 0);
    const wholeClass = this.wholeClassCache;

    this.container.innerHTML = `
      <!-- Workspace Header -->
      <div class="card" style="margin-bottom: var(--space-lg);">
        <div class="card-header">
          <div>
            <h2 class="card-title">Prediction Workflows & Future SGPA Forecasting</h2>
            <p class="card-subtitle">Consecutive transition modeling, individual least-squares trajectories, and whole-class forecasting (Phase 6)</p>
          </div>
          <div>
            ${hasAccepted 
              ? '<span class="badge badge-success">● Shared Cohort Model Ready</span>' 
              : '<span class="badge badge-synthetic">Dataset Inactive (Individual Trend Available)</span>'}
          </div>
        </div>

        <!-- Sub-Tab Switcher -->
        <div class="subtab-bar" role="tablist">
          <button class="subtab-btn ${this.activeSubtab === 'individual' ? 'active' : ''}" 
                  id="subtab-btn-individual" role="tab" 
                  aria-selected="${this.activeSubtab === 'individual'}">
            <span>👤 Individual Student Trajectory</span>
          </button>
          <button class="subtab-btn ${this.activeSubtab === 'wholeClass' ? 'active' : ''}" 
                  id="subtab-btn-class" role="tab" 
                  aria-selected="${this.activeSubtab === 'wholeClass'}">
            <span>👥 Whole-Class Cohort Prediction</span>
            ${hasAccepted && wholeClass ? `<span class="badge badge-neutral" style="font-size: 10px; margin-left: 4px;">${wholeClass.summaryCounts.totalStudents}</span>` : ''}
          </button>
        </div>

        <!-- Model Status & Temporal Validation Context -->
        ${this.renderModelStatusPanel(state, wholeClass)}
      </div>

      <!-- Active Subtab Workspace -->
      ${this.activeSubtab === 'individual' 
        ? this.renderIndividualWorkspace(state, wholeClass) 
        : this.renderWholeClassWorkspace(state, wholeClass)}
    `;
  }

  /**
   * Renders the model status and Phase 5 temporal validation context card.
   */
  renderModelStatusPanel(state, wholeClass) {
    const sharedModel = wholeClass ? wholeClass.sharedModel : null;
    const temporal = wholeClass ? wholeClass.temporalSummary : null;

    let modelStatusBadge = '<span class="badge badge-gray">SHARED MODEL UNAVAILABLE</span>';
    let modelStatusText = 'No cohort dataset accepted. Load and accept a dataset in Dataset & Dashboard to train the class-wide linear transition model.';

    if (wholeClass) {
      if (wholeClass.sharedModelStatus === 'FITTED' && sharedModel) {
        modelStatusBadge = '<span class="badge badge-success">● SHARED MODEL FITTED</span>';
        modelStatusText = `Trained on <strong>${wholeClass.transitionsCount}</strong> consecutive historical transitions. Fitted specification: <code style="color: var(--text-code);">${sharedModel.formula}</code>.`;
      } else if (wholeClass.sharedModelStatus === 'INSUFFICIENT_TRANSITIONS') {
        modelStatusBadge = '<span class="badge badge-amber">INSUFFICIENT TRANSITIONS</span>';
        modelStatusText = wholeClass.sharedModelError;
      } else if (wholeClass.sharedModelStatus === 'FIT_FAILED') {
        modelStatusBadge = '<span class="badge badge-crimson">FIT FAILED</span>';
        modelStatusText = `Linear regression solver failed: ${wholeClass.sharedModelError}`;
      }
    }

    return `
      <div style="background-color: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: var(--space-md); margin-top: var(--space-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 700;">
            Model Status & Validation Context
          </div>
          <div>${modelStatusBadge}</div>
        </div>
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
          ${modelStatusText}
        </div>

        ${temporal ? `
          <!-- Paired Historical Holdout Evidence -->
          <div style="border-top: 1px dashed var(--border-subtle); padding-top: 10px; margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">
                Historical Temporal Validation (Phase 5 Holdouts):
              </span>
              <span style="font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono);">
                n = ${temporal.pairedComparisonCount} paired test transitions
              </span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-sm); margin-bottom: 8px;">
              <div style="background-color: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 11px; color: var(--text-secondary);">Regression MAE / RMSE</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); font-family: var(--font-mono);">
                  ${temporal.pairedRegressionMae.toFixed(4)} / ${temporal.pairedRegressionRmse.toFixed(4)}
                </div>
              </div>
              <div style="background-color: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 11px; color: var(--text-secondary);">Persistence Baseline MAE / RMSE</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); font-family: var(--font-mono);">
                  ${temporal.pairedBaselineMae.toFixed(4)} / ${temporal.pairedBaselineRmse.toFixed(4)}
                </div>
              </div>
              <div style="background-color: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 11px; color: var(--text-secondary);">Holdout Outcome</div>
                <div style="font-size: 13px; font-weight: 700; color: ${temporal.regressionBeatsBaseline ? 'var(--accent-success)' : 'var(--accent-warning)'}; margin-top: 2px;">
                  ${temporal.regressionBeatsBaseline ? '✓ Regression Beat Persistence' : '⚠ Persistence Outperformed Regression'}
                </div>
              </div>
            </div>

            ${temporal.warning ? `
              <div class="callout callout-amber" style="margin-bottom: 6px;">
                <strong>Validation Safeguard:</strong> ${temporal.warning}
              </div>
            ` : ''}

            <div style="font-size: 11px; color: var(--text-tertiary); font-style: italic;">
              * Note: MAE and RMSE are reported in absolute SGPA units on past temporal holdouts. These metrics indicate historical empirical fit and do NOT represent percentage accuracy or guarantees of future performance.
            </div>
          </div>
        ` : `
          <div style="font-size: 11px; color: var(--text-tertiary); font-style: italic; border-top: 1px dashed var(--border-subtle); padding-top: 8px;">
            Historical validation metrics are unavailable until an accepted cohort dataset with sufficient consecutive transitions is loaded.
          </div>
        `}
      </div>
    `;
  }

  /**
   * Renders the individual student prediction form and results panel.
   */
  renderIndividualWorkspace(state, wholeClass) {
    const hasSharedModel = !!(wholeClass && wholeClass.sharedModelStatus === 'FITTED');
    const scaleMax = state.scaleMax;

    return `
      <div class="grid grid-cols-2" style="align-items: start;">
        <!-- Left: Observation History Input Form -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title" style="font-size: 16px;">Student Observation History</h3>
              <p class="card-subtitle">Enter between 3 and 7 observed semester results (Scale: 0.00 – ${scaleMax.toFixed(2)})</p>
            </div>
            <button class="btn btn-secondary" id="btn-sample-history" style="font-size: 12px; padding: 4px 10px;">
              Sample 4-Sem History
            </button>
          </div>

          <!-- Error Alert if validation fails -->
          ${this.individualError ? `
            <div class="callout callout-crimson" style="margin-bottom: var(--space-md);">
              <strong>Input Error:</strong> ${this.individualError}
            </div>
          ` : ''}

          <!-- Observation Rows -->
          <div style="margin-bottom: var(--space-md);">
            <div style="display: grid; grid-template-columns: 80px 1fr 1fr auto; gap: var(--space-sm); padding: 4px 10px; font-size: 11px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">
              <span>Row</span>
              <span>Semester No. (1-12)</span>
              <span>Observed SGPA</span>
              <span>Action</span>
            </div>
            <div id="observation-rows-container">
              ${this.individualObservations.map((obs, idx) => `
                <div class="observation-row" data-index="${idx}">
                  <span style="font-size: 12px; color: var(--text-tertiary); font-family: var(--font-mono); font-weight: 600;">
                    #${idx + 1}
                  </span>
                  <div>
                    <input type="number" class="form-control font-mono obs-sem-input" 
                           min="1" max="12" step="1" 
                           value="${obs.semester_no}" 
                           aria-label="Semester number for observation #${idx + 1}"
                           data-index="${idx}">
                  </div>
                  <div>
                    <input type="number" class="form-control font-mono obs-sgpa-input" 
                           min="0.00" max="${scaleMax.toFixed(2)}" step="0.01" 
                           value="${Number(obs.sgpa).toFixed(2)}" 
                           aria-label="SGPA for observation #${idx + 1}"
                           data-index="${idx}">
                  </div>
                  <div>
                    <button class="btn btn-secondary btn-remove-obs" 
                            data-index="${idx}" 
                            title="Remove observation row"
                            ${this.individualObservations.length <= 3 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}
                            style="padding: 6px 10px; font-size: 12px;">
                      ✕
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Row Controls -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
            <button class="btn btn-secondary" id="btn-add-observation" 
                    ${this.individualObservations.length >= 7 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}
                    style="font-size: 13px;">
              + Add Observation Row (${this.individualObservations.length}/7)
            </button>
            <span style="font-size: 12px; color: var(--text-tertiary);">
              Minimum 3, maximum 7 observations
            </span>
          </div>

          <!-- Model Selector -->
          <div class="form-group">
            <label class="form-label" for="select-individual-model">Forecasting Method</label>
            <select class="form-select" id="select-individual-model">
              <option value="${PREDICTION_MODELS.INDIVIDUAL_TREND}" ${this.selectedModel === PREDICTION_MODELS.INDIVIDUAL_TREND ? 'selected' : ''}>
                Model C: Individual Least-Squares Trend (s_k = a + b*k) — Self-Contained
              </option>
              <option value="${PREDICTION_MODELS.SHARED_REGRESSION}" ${this.selectedModel === PREDICTION_MODELS.SHARED_REGRESSION ? 'selected' : ''} ${!hasSharedModel ? 'disabled' : ''}>
                Model B: Shared Class-Wide Regression (s_{t+1} = a + b*s_t) ${!hasSharedModel ? '(Dataset required)' : ''}
              </option>
              <option value="${PREDICTION_MODELS.PERSISTENCE}" ${this.selectedModel === PREDICTION_MODELS.PERSISTENCE ? 'selected' : ''}>
                Baseline: Persistence Forecast (s_{t+1} = s_t)
              </option>
            </select>
            <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">
              ${this.selectedModel === PREDICTION_MODELS.INDIVIDUAL_TREND 
                ? 'Fits a straight line directly through this student’s observed semesters without requiring cohort data.' 
                : (this.selectedModel === PREDICTION_MODELS.SHARED_REGRESSION 
                    ? 'Evaluates student’s latest observed SGPA using the class-wide transition equation.' 
                    : 'Projects the latest observed SGPA forward without regression modeling.')}
            </div>
          </div>

          <!-- Action Button (Image 2 High-Contrast White Pill Style) -->
          <button class="btn btn-pill-white" id="btn-calc-individual" style="width: 100%; padding: 14px; font-size: 13.5px;">
            <span class="btn-arrow-icon">↘</span> COMPUTE NEXT-SEMESTER FORECAST
          </button>
        </div>

        <!-- Right: Prediction Result Display Panel -->
        <div>
          ${this.renderIndividualResultCard(scaleMax)}
        </div>
      </div>
    `;
  }

  /**
   * Renders the individual forecast result card or guidance placeholder.
   */
  renderIndividualResultCard(scaleMax) {
    if (!this.individualResult) {
      return `
        <div class="card" style="text-align: center; padding: var(--space-2xl) var(--space-lg); border: 1px dashed var(--border-subtle);">
          <div style="font-size: 32px; margin-bottom: var(--space-sm); color: var(--text-tertiary);">📊</div>
          <h4 style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
            Awaiting Prediction Request
          </h4>
          <p style="font-size: 13px; color: var(--text-secondary); max-width: 440px; margin: 0 auto;">
            Configure 3–7 observed semester records in the form and click <strong>Compute Next-Semester Forecast</strong> to evaluate the mathematical model.
          </p>
        </div>
      `;
    }

    const res = this.individualResult;
    const isOutOfRange = res.isOutOfRange;

    return `
      <div class="prediction-hero-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 700;">
              Forecast Target Semester
            </div>
            <div style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
              Semester ${res.targetSemester}
            </div>
          </div>
          <div>
            ${isOutOfRange 
              ? '<span class="badge badge-amber">⚠ OUT OF SCALE</span>' 
              : '<span class="badge badge-success">✓ PREDICTED</span>'}
          </div>
        </div>

        <!-- Primary Output Number -->
        <div style="margin-bottom: var(--space-md);">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">
            Raw Predicted SGPA (Scale 0.00 – ${scaleMax.toFixed(2)})
          </div>
          <div class="hero-prediction-val ${isOutOfRange ? 'text-amber' : ''}">
            ${res.rawPrediction !== null ? res.rawPrediction.toFixed(4) : 'N/A'}
          </div>
          ${isOutOfRange ? `
            <div style="font-size: 12px; color: var(--accent-warning); margin-top: 4px; font-weight: 600;">
              Note: Unclipped raw prediction falls outside the [0.00, ${scaleMax.toFixed(2)}] scale. Value is preserved without silent distortion.
            </div>
          ` : ''}
        </div>

        <!-- Predictor & Model Metadata -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-sm); margin-bottom: var(--space-md); background-color: var(--bg-primary); padding: var(--space-md); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Latest Observed</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono);">
              Sem ${res.latestSemester}: ${res.latestSgpa.toFixed(2)} SGPA
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Model Specification</div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">
              ${res.modelName}
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Observations Used</div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono);">
              ${res.observationCount} Semesters
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Degrees of Freedom (ν)</div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono);">
              ${res.degreesOfFreedom !== null ? `${res.degreesOfFreedom} (t_crit = ${res.tCritical})` : 'N/A (Shared Model)'}
            </div>
          </div>
        </div>

        <!-- Volatility Warning if low degrees of freedom -->
        ${res.volatilityWarning ? `
          <div class="callout callout-amber" style="margin-bottom: var(--space-md);">
            <strong>Sample Volatility Notice:</strong> ${res.volatilityWarning}
          </div>
        ` : ''}

        <!-- Method Explanation -->
        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-lg); background-color: rgba(20, 20, 26, 0.6); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm);">
          <strong>Method Explanation:</strong> ${res.explanation}
          <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px; font-style: italic;">
            Disclaimer: A mathematical fit does not establish statistical confidence. Short individual histories (3–5 semesters) remain sensitive to singular academic disruptions.
          </div>
        </div>

        <!-- Export Action -->
        <button class="btn btn-secondary" id="btn-export-individual" style="width: 100%; font-size: 13px;">
          📥 Download Individual Result (.csv)
        </button>
      </div>
    `;
  }

  /**
   * Renders the whole-class batch prediction workspace.
   */
  renderWholeClassWorkspace(state, wholeClass) {
    if (!wholeClass || wholeClass.status === 'EMPTY_DATASET' || !state.acceptedDataset) {
      return `
        <div class="card" style="text-align: center; padding: var(--space-2xl) var(--space-lg);">
          <div style="font-size: 36px; margin-bottom: var(--space-sm); color: var(--text-tertiary);">📂</div>
          <h3 class="card-title" style="margin-bottom: 6px;">No Active Cohort Dataset in Session Memory</h3>
          <p class="card-subtitle" style="max-width: 500px; margin: 0 auto var(--space-lg) auto;">
            Whole-class prediction requires an accepted long-format CSV dataset. Import historical records in the Dataset & Dashboard workspace to proceed.
          </p>
          <button class="btn btn-primary" id="btn-nav-dataset" style="font-size: 13px;">
            ← Go to Dataset Management
          </button>
        </div>
      `;
    }

    const { summaryCounts, students, sharedModelStatus } = wholeClass;

    // Filter students
    let filtered = students.filter(s => {
      // Status filter
      if (this.classFilterStatus === 'PREDICTED' && s.prediction_status !== PREDICTION_STATUS.PREDICTED) return false;
      if (this.classFilterStatus === 'OUT_OF_RANGE' && !s.out_of_range) return false;
      if (this.classFilterStatus === 'UNAVAILABLE' && s.prediction_status === PREDICTION_STATUS.PREDICTED) return false;

      // Search query
      if (this.classSearchQuery.trim()) {
        const q = this.classSearchQuery.trim().toLowerCase();
        if (!s.student_key.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    // Sort students
    filtered.sort((a, b) => {
      let valA = a[this.classSortColumn];
      let valB = b[this.classSortColumn];

      if (valA === null || valA === undefined) valA = -Infinity;
      if (valB === null || valB === undefined) valB = -Infinity;

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return this.classSortDirection === 'asc' ? cmp : -cmp;
      }

      const diff = valA - valB;
      return this.classSortDirection === 'asc' ? diff : -diff;
    });

    return `
      <!-- KPI Overview Grid -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Cohort Students</div>
          <div class="kpi-value">${summaryCounts.totalStudents}</div>
          <div class="kpi-meta">Distinct student keys in session</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Predictions Generated</div>
          <div class="kpi-value" style="color: var(--accent-success);">${summaryCounts.predictedCount}</div>
          <div class="kpi-meta">Valid model outputs</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Out-of-Range Estimates</div>
          <div class="kpi-value" style="color: var(--accent-warning);">${summaryCounts.outOfRangeCount}</div>
          <div class="kpi-meta">Preserved unclipped (< 0.00 or > ${state.scaleMax.toFixed(2)})</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Unavailable / Gapped</div>
          <div class="kpi-value" style="color: var(--accent-primary);">${summaryCounts.unavailableCount}</div>
          <div class="kpi-meta">Insufficient history or missing gaps</div>
        </div>
      </div>

      <!-- Controls & Table Card -->
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: var(--space-md);">
          <!-- Filters -->
          <div class="filter-btn-group">
            <button class="filter-btn ${this.classFilterStatus === 'ALL' ? 'active' : ''}" data-filter="ALL">
              All Students (${summaryCounts.totalStudents})
            </button>
            <button class="filter-btn ${this.classFilterStatus === 'PREDICTED' ? 'active' : ''}" data-filter="PREDICTED">
              Valid Forecasts (${summaryCounts.predictedCount})
            </button>
            <button class="filter-btn ${this.classFilterStatus === 'OUT_OF_RANGE' ? 'active' : ''}" data-filter="OUT_OF_RANGE">
              Out of Scale (${summaryCounts.outOfRangeCount})
            </button>
            <button class="filter-btn ${this.classFilterStatus === 'UNAVAILABLE' ? 'active' : ''}" data-filter="UNAVAILABLE">
              Unavailable (${summaryCounts.unavailableCount})
            </button>
          </div>

          <!-- Search & Export Actions -->
          <div style="display: flex; gap: var(--space-sm); align-items: center;">
            <input type="text" id="input-class-search" class="form-control" 
                   placeholder="Filter by Student Key..." 
                   value="${this.classSearchQuery}"
                   style="width: 200px; padding: 6px 10px; font-size: 13px;">
            <button class="btn btn-secondary" id="btn-export-class" style="font-size: 13px; padding: 6px 14px;">
              📥 Export CSV
            </button>
          </div>
        </div>

        <!-- Predictions Table -->
        <div class="table-wrapper cp-table-scroll">
          <table class="data-table cp-table">
            <thead>
              <tr>
                <th class="sortable-th" data-sort="student_key">
                  Student Key ${this.getSortIcon('student_key')}
                </th>
                <th>Latest Sem</th>
                <th class="sortable-th" data-sort="latest_sgpa">
                  Latest SGPA ${this.getSortIcon('latest_sgpa')}
                </th>
                <th class="sortable-th" data-sort="target_semester">
                  Target Sem ${this.getSortIcon('target_semester')}
                </th>
                <th class="sortable-th" data-sort="predicted_sgpa">
                  Predicted SGPA (Regression) ${this.getSortIcon('predicted_sgpa')}
                </th>
                <th>Baseline (Persistence)</th>
                <th>Model</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: var(--space-xl); color: var(--text-tertiary);">
                    No student records match the active filter criteria.
                  </td>
                </tr>
              ` : filtered.map(s => {
                const isPred = s.prediction_status === PREDICTION_STATUS.PREDICTED || s.prediction_status === PREDICTION_STATUS.OUT_OF_RANGE;
                const statusBadge = s.out_of_range
                  ? '<span class="badge badge-amber">OUT OF SCALE</span>'
                  : (isPred 
                      ? '<span class="badge badge-success">PREDICTED</span>' 
                      : `<span class="badge badge-crimson" title="${s.status_reason || ''}">${s.prediction_status}</span>`);

                return `
                  <tr>
                    <td><strong>${s.student_key}</strong></td>
                    <td>Sem ${s.latest_semester}</td>
                    <td>${s.latest_sgpa.toFixed(2)}</td>
                    <td>Sem ${s.target_semester}</td>
                    <td style="color: ${s.out_of_range ? 'var(--accent-warning)' : (isPred ? 'var(--text-primary)' : 'var(--text-tertiary)')}; font-weight: 700;">
                      ${s.predicted_sgpa !== null ? s.predicted_sgpa.toFixed(4) : '<span style="color: var(--text-tertiary); font-weight: normal;">—</span>'}
                    </td>
                    <td style="color: var(--text-secondary);">
                      ${s.baseline_prediction.toFixed(2)}
                    </td>
                    <td style="font-size: 11px; color: var(--text-tertiary);">
                      ${s.model_name}
                    </td>
                    <td>${statusBadge}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="padding: var(--space-sm) var(--space-md); font-size: 11px; color: var(--text-tertiary); border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between;">
          <span>Showing ${filtered.length} of ${students.length} cohort students</span>
          <span>Predictions maintain raw numeric precision without silent scale clamping</span>
        </div>
      </div>
    `;
  }

  /**
   * Returns sort arrow icon for column header.
   */
  getSortIcon(col) {
    if (this.classSortColumn !== col) return '<span class="sort-icon">⇅</span>';
    return this.classSortDirection === 'asc' ? '<span class="sort-icon" style="color: var(--accent-primary);">▲</span>' : '<span class="sort-icon" style="color: var(--accent-primary);">▼</span>';
  }

  /**
   * Binds user event listeners.
   */
  bindEvents() {
    // 1. Sub-tab switching
    const btnInd = this.container.querySelector('#subtab-btn-individual');
    const btnClass = this.container.querySelector('#subtab-btn-class');
    if (btnInd) {
      btnInd.addEventListener('click', () => {
        this.activeSubtab = 'individual';
        this.render();
        this.bindEvents();
      });
    }
    if (btnClass) {
      btnClass.addEventListener('click', () => {
        this.activeSubtab = 'wholeClass';
        this.render();
        this.bindEvents();
      });
    }

    // 2. Individual observation input changes
    const semInputs = this.container.querySelectorAll('.obs-sem-input');
    semInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.index);
        this.individualObservations[idx].semester_no = Number(e.target.value);
      });
    });

    const sgpaInputs = this.container.querySelectorAll('.obs-sgpa-input');
    sgpaInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.index);
        this.individualObservations[idx].sgpa = Number(e.target.value);
      });
    });

    // 3. Add observation row
    const btnAddObs = this.container.querySelector('#btn-add-observation');
    if (btnAddObs) {
      btnAddObs.addEventListener('click', () => {
        if (this.individualObservations.length < 7) {
          const maxSem = this.individualObservations.reduce((m, o) => Math.max(m, o.semester_no), 0);
          this.individualObservations.push({
            semester_no: maxSem + 1 <= 12 ? maxSem + 1 : 12,
            sgpa: 3.50
          });
          this.render();
          this.bindEvents();
        }
      });
    }

    // 4. Remove observation row
    const removeBtns = this.container.querySelectorAll('.btn-remove-obs');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(btn.dataset.index);
        if (this.individualObservations.length > 3) {
          this.individualObservations.splice(idx, 1);
          this.render();
          this.bindEvents();
        }
      });
    });

    // 5. Pre-fill sample history
    const btnSample = this.container.querySelector('#btn-sample-history');
    if (btnSample) {
      btnSample.addEventListener('click', () => {
        this.individualObservations = [
          { semester_no: 1, sgpa: 3.20 },
          { semester_no: 2, sgpa: 3.35 },
          { semester_no: 3, sgpa: 3.48 },
          { semester_no: 4, sgpa: 3.56 }
        ];
        this.individualError = null;
        this.render();
        this.bindEvents();
      });
    }

    // 6. Model selector
    const modelSelect = this.container.querySelector('#select-individual-model');
    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        this.selectedModel = e.target.value;
        this.render();
        this.bindEvents();
      });
    }

    // 7. Calculate individual prediction
    const btnCalc = this.container.querySelector('#btn-calc-individual');
    if (btnCalc) {
      btnCalc.addEventListener('click', () => {
        this.handleIndividualPredict();
      });
    }

    // 8. Export individual result CSV
    const btnExportInd = this.container.querySelector('#btn-export-individual');
    if (btnExportInd) {
      btnExportInd.addEventListener('click', () => {
        if (this.individualResult) {
          const csvText = exportIndividualCSV(this.individualResult);
          this.downloadFile(csvText, `individual_forecast_sem${this.individualResult.targetSemester}.csv`, 'text/csv;charset=utf-8;');
        }
      });
    }

    // 9. Whole-class filter buttons
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.classFilterStatus = btn.dataset.filter;
        this.render();
        this.bindEvents();
      });
    });

    // 10. Whole-class search query
    const searchInput = this.container.querySelector('#input-class-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.classSearchQuery = e.target.value;
        this.render();
        this.bindEvents();
      });
    }

    // 11. Whole-class table column sorting
    const sortHeaders = this.container.querySelectorAll('.sortable-th');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (this.classSortColumn === col) {
          this.classSortDirection = this.classSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.classSortColumn = col;
          this.classSortDirection = 'asc';
        }
        this.render();
        this.bindEvents();
      });
    });

    // 12. Export whole-class CSV
    const btnExportClass = this.container.querySelector('#btn-export-class');
    if (btnExportClass) {
      btnExportClass.addEventListener('click', () => {
        if (this.wholeClassCache && this.wholeClassCache.students) {
          const csvText = exportWholeClassCSV(this.wholeClassCache.students);
          this.downloadFile(csvText, `cohort_predictions_class_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
        }
      });
    }

    // 13. Nav to dataset tab if in empty state
    const btnNavDataset = this.container.querySelector('#btn-nav-dataset');
    if (btnNavDataset) {
      btnNavDataset.addEventListener('click', () => {
        const datasetBtn = document.querySelector('[data-nav-id="dataset"]') || document.getElementById('tab-btn-dataset');
        if (datasetBtn) datasetBtn.click();
      });
    }
  }

  /**
   * Executes individual student prediction.
   */
  handleIndividualPredict() {
    this.individualError = null;
    const state = stateManager.getState();
    const sharedModel = this.wholeClassCache ? this.wholeClassCache.sharedModel : null;

    try {
      this.individualResult = predictIndividualStudent(
        this.individualObservations,
        this.selectedModel,
        {
          scaleMax: state.scaleMax,
          sharedModel: sharedModel
        }
      );
    } catch (err) {
      this.individualError = err.message || "Failed to compute prediction.";
      this.individualResult = null;
    }

    this.render();
    this.bindEvents();
  }

  /**
   * Helper to download text content as a file client-side.
   * Zero server upload, complete ephemeral client isolation.
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
