/**
 * @file dashboard_view.js
 * @description Presentation layer component for Phase 8 Analytical Dashboard & Visualizations.
 * Renders cohort summaries, SVG transition scatter plots, in-sample residual plots,
 * semester histograms & boxplots, holdout temporal evaluations, transition matrices,
 * and deterministic IQR review candidates.
 * Document Reference: docs/UI_UX_DESIGN.md, docs/REQUIREMENTS.md (FR-01, FR-08)
 */

import { stateManager } from '../services/state_manager.js';
import { 
  computeCohortOverview, 
  computeSemesterDistribution, 
  computeTransitionScatter, 
  computeResidualAnalysis, 
  computeTransitionMatrix, 
  detectUnusualObservations, 
  computeDashboardTemporalEvaluation,
  GPA_SCALE_MAX
} from '../core/dashboard_analytics.js';
import { predictWholeClass, PREDICTION_STATUS } from '../core/prediction_service.js';

export class DashboardView {
  /**
   * @param {HTMLElement} container - DOM container element
   */
  constructor(container) {
    this.container = container;
    this.unsubscribe = null;

    // View state
    this.activeSubtab = 'transitions'; // 'transitions' | 'distributions' | 'evaluation' | 'matrix' | 'candidates'
    this.selectedSemester = 'all';
    this.showPersistenceLine = true;
    this.showTableView = false;
  }

  /**
   * Initializes view, subscribes to state manager, and renders.
   */
  init() {
    this.render();
    this.bindEvents();

    this.unsubscribe = stateManager.subscribe(() => {
      this.render();
      this.bindEvents();
    });
  }

  /**
   * Cleans up subscriptions and listeners when leaving view.
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Renders the complete dashboard interface.
   */
  render() {
    const state = stateManager.getState();
    const dataset = state.acceptedDataset;
    const overview = computeCohortOverview(dataset);

    // If no active dataset, render educational empty state
    if (!overview.hasDataset) {
      this.container.innerHTML = this.renderEmptyState();
      return;
    }

    // Default to 'all' or first observed semester
    if (this.selectedSemester !== 'all' && !overview.observedSemesters.includes(Number(this.selectedSemester))) {
      this.selectedSemester = 'all';
    }

    this.container.innerHTML = `
      <div class="cp-page-stack">
        <!-- Academic Hero Header -->
        ${this.renderAcademicHero(overview)}

        <!-- 4 Primary Calculated KPI Cards -->
        ${this.renderOverviewKPIs(overview)}

        <!-- 4-Panel Analytical Overview Grid -->
        ${this.renderAnalyticsGrid(dataset, overview)}

        <!-- Detailed Analytical Deep-Dive Section -->
        <div class="card" style="margin-top: var(--space-xl); margin-bottom: var(--space-xl);">
          <div class="card-header">
            <div>
              <h2 class="card-title" style="font-size: 19px; font-weight: 700;">Detailed Analytical Deep-Dive</h2>
              <p class="card-subtitle">Examine underlying transition pairs, distribution statistics, holdout folds, and outlier diagnostics</p>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${overview.isSynthetic ? '<span class="badge badge-synthetic">Synthetic Demo Mode</span>' : ''}
              <span class="badge badge-success">● Dataset Active (${overview.totalRecords} Records)</span>
            </div>
          </div>

          <!-- Sub-Tab Navigation -->
          <div class="subtab-nav" style="margin-top: var(--space-lg);" role="tablist">
            <button class="subtab-btn ${this.activeSubtab === 'transitions' ? 'active' : ''}" data-subtab="transitions" role="tab">
              📈 Transitions &amp; Regression
            </button>
            <button class="subtab-btn ${this.activeSubtab === 'distributions' ? 'active' : ''}" data-subtab="distributions" role="tab">
              📊 Semester Distributions
            </button>
            <button class="subtab-btn ${this.activeSubtab === 'evaluation' ? 'active' : ''}" data-subtab="evaluation" role="tab">
              🛡️ Temporal Evaluation
            </button>
            <button class="subtab-btn ${this.activeSubtab === 'matrix' ? 'active' : ''}" data-subtab="matrix" role="tab">
              🔲 Transition Matrix
            </button>
            <button class="subtab-btn ${this.activeSubtab === 'candidates' ? 'active' : ''}" data-subtab="candidates" role="tab">
              🔍 Review Candidates
            </button>
          </div>
        </div>

        <!-- Active Sub-tab View Container -->
        <div id="subtab-content">
          ${this.renderActiveSubtab(dataset, overview)}
        </div>

        <!-- Floating Chart Tooltip -->
        <div id="chart-tooltip" class="chart-tooltip"></div>
      </div>
    `;
  }

  /**
   * Renders the academic analytics hero header inspired by reference design.
   * Excludes all editorial photography, fictional ratings, and hardcoded MAE values.
   */
  renderAcademicHero(overview = null) {
    return `
      <section class="cp-academic-hero" aria-label="ClassPredict Overview Hero">
        <div class="cp-academic-hero-content">
          <div>
            <span class="cp-hero-kicker">CSE NUMERICAL METHODS PROJECT</span>
            <h1 class="cp-hero-title">Class<span>Predict</span></h1>
            <p class="cp-hero-subtitle">Academic Performance Analytics &amp; SGPA Prediction</p>
            <p class="cp-hero-desc">
              Analyze academic trends, predict next-semester SGPA using numerical methods, ingest result sheets with OCR, and explore core numerical algorithms — all in your browser.
            </p>
            <div class="cp-hero-actions">
              <button class="cp-button cp-button-primary" id="btn-hero-load-dataset" type="button">
                📤 Load Dataset
              </button>
              <button class="cp-button cp-button-secondary" id="btn-hero-demo-load" type="button">
                ▶ Try Synthetic Demo
              </button>
            </div>
          </div>
          <div class="cp-hero-features">
            <div class="cp-hero-feature-item">
              <span class="cp-feat-icon">📊</span>
              <span>Data-Driven Analytics</span>
            </div>
            <div class="cp-hero-feature-item">
              <span class="cp-feat-icon">📈</span>
              <span>SGPA Prediction</span>
            </div>
            <div class="cp-hero-feature-item">
              <span class="cp-feat-icon">📄</span>
              <span>OCR-based Import</span>
            </div>
            <div class="cp-hero-feature-item">
              <span class="cp-feat-icon">🔬</span>
              <span>Numerical Methods Lab</span>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Renders the empty state when no dataset is loaded.
   */
  renderEmptyState() {
    return `
      <div class="cp-page-stack">
        ${this.renderAcademicHero(null)}

        <div class="card" style="margin-bottom: var(--space-xl); text-align: center; padding: var(--space-2xl) var(--space-lg);">
          <div style="font-size: 48px; margin-bottom: var(--space-md);">📊</div>
          <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin-bottom: 8px;">
            No Cohort Dataset Loaded in Session Memory
          </h2>
          <p style="font-size: 14px; max-width: 620px; margin: 0 auto var(--space-xl) auto; color: var(--color-muted); line-height: 1.6;">
            The Analytical Dashboard computes empirical transition dynamics, semester histograms, boxplots, in-sample residuals, and rolling-origin backtesting. Import a long-format CSV or scan marksheet PDFs via client-side OCR to begin.
          </p>

          <div style="display: flex; justify-content: center; gap: var(--space-md); flex-wrap: wrap;">
            <button class="cp-button cp-button-primary" id="btn-demo-load" type="button">
              ⚡ Load Synthetic Sample Dataset (13 Students)
            </button>
            <button class="cp-button cp-button-secondary" id="btn-goto-dataset" type="button">
              📥 Import Long-Format CSV
            </button>
            <button class="cp-button cp-button-secondary" id="btn-goto-ocr" type="button">
              📷 Scan Document via OCR
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders high-level dataset metrics in data-first cards.
   */
  renderOverviewKPIs(overview) {
    const gapsNotice = overview.studentsWithGapsCount > 0
      ? `<div class="cp-alert cp-alert-warning" style="margin-top: 14px;">
           <strong>Notice</strong>: ${overview.studentsWithGapsCount} student(s) contain non-consecutive semester gaps. Non-bridging policy strictly excludes artificial transition jumps.
         </div>`
      : '';

    return `
      <div class="cp-kpi-grid">
        <article class="cp-kpi">
          <span class="cp-kpi-icon">👥</span>
          <div>
            <small>Unique Students</small>
            <strong>${overview.totalStudents}</strong>
            <span>Pseudonymous records</span>
          </div>
        </article>
        <article class="cp-kpi">
          <span class="cp-kpi-icon">📑</span>
          <div>
            <small>Accepted Records</small>
            <strong>${overview.totalRecords}</strong>
            <span>Valid semester entries (Sem ${overview.minSemester}–${overview.maxSemester})</span>
          </div>
        </article>
        <article class="cp-kpi">
          <span class="cp-kpi-icon">🔗</span>
          <div>
            <small>Valid Transitions</small>
            <strong>${overview.validTransitionsCount}</strong>
            <span>Consecutive semesters</span>
          </div>
        </article>
        <article class="cp-kpi">
          <span class="cp-kpi-icon">📈</span>
          <div>
            <small>Shared Model</small>
            <strong class="cp-kpi-text">${overview.canFitRegression ? 'Linear Regression' : 'Persistence Baseline'}</strong>
            <span>
              <i class="cp-status-dot ${overview.canFitRegression ? '' : 'is-empty'}"></i>
              ${overview.canFitRegression ? 'Trained on historical data' : (overview.regressionStatus || 'Model Fallback')}
            </span>
          </div>
        </article>
      </div>
      ${gapsNotice}
    `;
  }

  /**
   * Renders the 4-panel analytical grid inspired by the reference design:
   * 1. Semester SGPA Distribution Histogram
   * 2. Historical vs Predicted SGPA Transition Scatter Plot
   * 3. Next-Semester Prediction Preview Table
   * 4. Model Performance (Temporal Validation) Comparison Bars
   */
  renderAnalyticsGrid(dataset, overview) {
    return `
      <div class="cp-dashboard-grid" style="margin-top: var(--space-xl);">
        ${this.renderDistributionPanel(dataset, overview)}
        ${this.renderScatterPanel(dataset, overview)}
        ${this.renderPredictionPreviewPanel(dataset)}
        ${this.renderTemporalEvaluationPanel(dataset)}
      </div>
    `;
  }

  /**
   * Panel 1: Semester SGPA Distribution Histogram
   */
  renderDistributionPanel(dataset, overview) {
    const isAll = this.selectedSemester === 'all';
    const activeSem = isAll ? null : Number(this.selectedSemester);

    let binCounts = [0, 0, 0, 0, 0, 0, 0, 0];
    let totalCount = 0;

    if (isAll) {
      for (const r of dataset) {
        let idx = Math.floor(r.sgpa / 0.5);
        if (idx >= 8) idx = 7;
        if (idx < 0) idx = 0;
        binCounts[idx]++;
        totalCount++;
      }
    } else {
      const dist = computeSemesterDistribution(dataset, activeSem);
      if (dist && dist.histogram && dist.histogram.bins) {
        binCounts = dist.histogram.bins.map(b => b.count);
        totalCount = dist.histogram.totalObservations;
      }
    }

    const maxCount = Math.max(1, ...binCounts);
    const maxBarHeight = 110;
    const barsSvg = binCounts.map((count, i) => {
      const h = (count / maxCount) * maxBarHeight;
      const x = 35 + i * 54;
      const y = 145 - h;
      return `
        <rect x="${x}" y="${y.toFixed(1)}" width="38" height="${Math.max(2, h).toFixed(1)}" rx="3" fill="#ff3038" opacity="0.9" />
        ${count > 0 ? `<text x="${x + 19}" y="${Math.max(14, y - 5).toFixed(1)}" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="var(--font-mono)" font-weight="600">${count}</text>` : ''}
      `;
    }).join('');

    const optionsHtml = `
      <option value="all" ${isAll ? 'selected' : ''}>All Semesters</option>
      ${overview.observedSemesters.map(s => `
        <option value="${s}" ${!isAll && activeSem === s ? 'selected' : ''}>Semester ${s}</option>
      `).join('')}
    `;

    return `
      <article class="cp-panel cp-panel-span-7">
        <header class="cp-panel-header">
          <div>
            <span class="cp-kicker">Distribution</span>
            <h2>Semester SGPA Distribution</h2>
          </div>
          <select class="cp-select cp-select-sm" id="dashboard-semester-select" aria-label="Select Semester">
            ${optionsHtml}
          </select>
        </header>
        <svg class="cp-preview-chart" viewBox="0 0 490 190" role="img" aria-label="SGPA Distribution Histogram">
          <g class="chart-grid">
            <line x1="30" y1="145" x2="475" y2="145" stroke="var(--cp-line-strong)" stroke-width="1" />
            <line x1="30" y1="90" x2="475" y2="90" stroke="var(--cp-line)" stroke-dasharray="3,3" />
            <line x1="30" y1="35" x2="475" y2="35" stroke="var(--cp-line)" stroke-dasharray="3,3" />
          </g>
          ${barsSvg}
          <g font-size="10" font-family="var(--font-mono)" fill="var(--cp-text-muted)" text-anchor="middle">
            <text x="35" y="165">0.0</text>
            <text x="89" y="165">0.5</text>
            <text x="143" y="165">1.0</text>
            <text x="197" y="165">1.5</text>
            <text x="251" y="165">2.0</text>
            <text x="305" y="165">2.5</text>
            <text x="359" y="165">3.0</text>
            <text x="413" y="165">3.5</text>
            <text x="467" y="165">4.0</text>
          </g>
        </svg>
        <p class="cp-panel-note">Showing distribution of ${totalCount} recorded SGPA entries across 0.5-width bins.</p>
      </article>
    `;
  }

  /**
   * Panel 2: Historical vs Predicted SGPA Transition Scatter Plot
   */
  renderScatterPanel(dataset, overview) {
    const scatter = computeTransitionScatter(dataset);
    const hasPoints = scatter.points && scatter.points.length > 0;

    const scaleX = v => 45 + (v / 4.0) * 420;
    const scaleY = v => 165 - (v / 4.0) * 135;

    const pointsSvg = hasPoints ? scatter.points.map(pt => {
      const cx = scaleX(pt.x).toFixed(1);
      const cy = scaleY(pt.y).toFixed(1);
      return `<circle cx="${cx}" cy="${cy}" r="4.5" fill="#ff3038" opacity="0.85" />`;
    }).join('') : '';

    let regressionLineSvg = '';
    if (scatter.regressionLine) {
      const rl = scatter.regressionLine;
      const y0 = Math.max(0, Math.min(4, rl.y1));
      const y4 = Math.max(0, Math.min(4, rl.y2));
      regressionLineSvg = `
        <line x1="${scaleX(0).toFixed(1)}" y1="${scaleY(y0).toFixed(1)}" x2="${scaleX(4).toFixed(1)}" y2="${scaleY(y4).toFixed(1)}" stroke="#ff3038" stroke-width="2.5" />
      `;
    }

    const persistenceLineSvg = `
      <line x1="${scaleX(0).toFixed(1)}" y1="${scaleY(0).toFixed(1)}" x2="${scaleX(4).toFixed(1)}" y2="${scaleY(4).toFixed(1)}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4,4" />
    `;

    return `
      <article class="cp-panel cp-panel-span-5">
        <header class="cp-panel-header">
          <div>
            <span class="cp-kicker">Model Evidence</span>
            <h2>Historical vs Predicted SGPA</h2>
          </div>
          <span class="cp-badge cp-badge-success">${scatter.totalTransitions} transitions</span>
        </header>
        <svg class="cp-preview-chart" viewBox="0 0 490 190" role="img" aria-label="Historical vs Predicted SGPA Scatter Plot">
          <g class="chart-grid">
            <line x1="45" y1="165" x2="465" y2="165" stroke="var(--cp-line-strong)" />
            <line x1="45" y1="30" x2="45" y2="165" stroke="var(--cp-line-strong)" />
            <line x1="45" y1="131" x2="465" y2="131" stroke="var(--cp-line)" stroke-dasharray="2,2" />
            <line x1="45" y1="97" x2="465" y2="97" stroke="var(--cp-line)" stroke-dasharray="2,2" />
            <line x1="45" y1="63" x2="465" y2="63" stroke="var(--cp-line)" stroke-dasharray="2,2" />
          </g>
          ${persistenceLineSvg}
          ${regressionLineSvg}
          <g class="chart-points">${pointsSvg}</g>
          <g font-size="10" font-family="var(--font-mono)" fill="var(--cp-text-muted)">
            <text x="45" y="180" text-anchor="middle">0.0</text>
            <text x="150" y="180" text-anchor="middle">1.0</text>
            <text x="255" y="180" text-anchor="middle">2.0</text>
            <text x="360" y="180" text-anchor="middle">3.0</text>
            <text x="465" y="180" text-anchor="middle">4.0</text>
            <text x="35" y="169" text-anchor="end">0</text>
            <text x="35" y="101" text-anchor="end">2</text>
            <text x="35" y="34" text-anchor="end">4</text>
          </g>
        </svg>
        <div class="cp-chart-legend">
          <span><i class="legend-dot" style="background:#ff3038;"></i> Observed Transitions</span>
          <span><i class="legend-line" style="background:#ff3038;"></i> Fitted Regression</span>
          <span><i class="legend-line" style="background:#64748b; border-style:dashed;"></i> Persistence Baseline</span>
        </div>
      </article>
    `;
  }

  /**
   * Panel 3: Next-Semester Prediction Preview Table
   */
  renderPredictionPreviewPanel(dataset) {
    const classResults = predictWholeClass(dataset);
    const students = classResults.students || [];
    const previewList = students.slice(0, 5);

    const rowsHtml = previewList.map(s => {
      const pred = s.predicted_sgpa;
      const base = s.baseline_prediction;
      const diff = pred !== null ? pred - base : null;
      const diffStr = diff !== null ? (diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)) : '—';
      const diffClass = diff !== null && diff >= 0 ? 'cp-positive' : 'cp-warning-text';
      const statusBadge = s.out_of_range
        ? `<span class="cp-badge cp-badge-warning">High (Unclipped)</span>`
        : `<span class="cp-badge cp-badge-success">In Range</span>`;

      return `
        <tr>
          <td><code>${this.escapeHtml(s.student_key)}</code></td>
          <td>Sem ${s.latest_semester}</td>
          <td>${pred !== null ? pred.toFixed(2) : '—'}</td>
          <td>${base.toFixed(2)}</td>
          <td class="${diffClass}">${diffStr}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');

    return `
      <article class="cp-panel cp-panel-span-8">
        <header class="cp-panel-header">
          <div>
            <span class="cp-kicker">Forecast Preview</span>
            <h2>Next-Semester Prediction Preview</h2>
          </div>
          <button class="cp-button cp-button-ghost cp-button-sm" id="btn-preview-view-all" type="button">
            View All →
          </button>
        </header>
        <div class="cp-table-scroll">
          <table class="cp-table">
            <thead>
              <tr>
                <th>Student Key</th>
                <th>Last Sem</th>
                <th>Predicted</th>
                <th>Baseline</th>
                <th>Δ (Pred - Base)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6" style="text-align:center; color:var(--cp-text-muted);">No student predictions available</td></tr>'}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }

  /**
   * Panel 4: Model Performance (Temporal Validation) Comparison Bars
   */
  renderTemporalEvaluationPanel(dataset) {
    const evalData = computeDashboardTemporalEvaluation(dataset);

    if (!evalData.evaluationAvailable) {
      return `
        <article class="cp-panel cp-panel-span-4">
          <header class="cp-panel-header">
            <div>
              <span class="cp-kicker">Temporal Validation</span>
              <h2>Model Performance (Temporal Validation)</h2>
            </div>
          </header>
          <div class="cp-alert cp-alert-info" style="margin-top: 14px;">
            <strong>Holdout Validation Status: Unavailable</strong>
            <span>${this.escapeHtml(evalData.message || 'At least 2 consecutive historical test periods are required for holdout validation.')}</span>
          </div>
          <p class="cp-panel-note">Requires expanding-window historical folds.</p>
        </article>
      `;
    }

    const m = evalData.pairedMetrics;
    const maxVal = Math.max(0.1, m.regressionMae, m.baselineMae, m.regressionRmse, m.baselineRmse);
    const maxBarHeight = 90;

    const rMaeH = (m.regressionMae / maxVal) * maxBarHeight;
    const bMaeH = (m.baselineMae / maxVal) * maxBarHeight;
    const rRmseH = (m.regressionRmse / maxVal) * maxBarHeight;
    const bRmseH = (m.baselineRmse / maxVal) * maxBarHeight;

    return `
      <article class="cp-panel cp-panel-span-4">
        <header class="cp-panel-header">
          <div>
            <span class="cp-kicker">Temporal Validation</span>
            <h2>Model Performance (Temporal Validation)</h2>
          </div>
          <span class="cp-badge cp-badge-info">${evalData.pairedComparisonCount} pairs</span>
        </header>
        <svg class="cp-preview-chart" viewBox="0 0 380 180" role="img" aria-label="Temporal Validation Comparison Bar Chart">
          <g class="chart-grid">
            <line x1="30" y1="135" x2="350" y2="135" stroke="var(--cp-line-strong)" />
          </g>
          <!-- MAE Group -->
          <g>
            <rect x="65" y="${(135 - rMaeH).toFixed(1)}" width="36" height="${Math.max(2, rMaeH).toFixed(1)}" rx="3" fill="#ff3038" />
            <text x="83" y="${Math.max(16, 130 - rMaeH).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-size="10" font-family="var(--font-mono)" font-weight="700">${m.regressionMae.toFixed(3)}</text>
            <rect x="108" y="${(135 - bMaeH).toFixed(1)}" width="36" height="${Math.max(2, bMaeH).toFixed(1)}" rx="3" fill="#64748b" />
            <text x="126" y="${Math.max(16, 130 - bMaeH).toFixed(1)}" text-anchor="middle" fill="#cbd5e1" font-size="10" font-family="var(--font-mono)" font-weight="700">${m.baselineMae.toFixed(3)}</text>
            <text x="105" y="155" text-anchor="middle" fill="var(--cp-text-muted)" font-size="11" font-weight="600">MAE (↓ better)</text>
          </g>
          <!-- RMSE Group -->
          <g>
            <rect x="235" y="${(135 - rRmseH).toFixed(1)}" width="36" height="${Math.max(2, rRmseH).toFixed(1)}" rx="3" fill="#ff3038" />
            <text x="253" y="${Math.max(16, 130 - rRmseH).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-size="10" font-family="var(--font-mono)" font-weight="700">${m.regressionRmse.toFixed(3)}</text>
            <rect x="278" y="${(135 - bRmseH).toFixed(1)}" width="36" height="${Math.max(2, bRmseH).toFixed(1)}" rx="3" fill="#64748b" />
            <text x="296" y="${Math.max(16, 130 - bRmseH).toFixed(1)}" text-anchor="middle" fill="#cbd5e1" font-size="10" font-family="var(--font-mono)" font-weight="700">${m.baselineRmse.toFixed(3)}</text>
            <text x="275" y="155" text-anchor="middle" fill="var(--cp-text-muted)" font-size="11" font-weight="600">RMSE (↓ better)</text>
          </g>
        </svg>
        <div class="cp-chart-legend">
          <span><i class="legend-dot" style="background:#ff3038;"></i> Regression Model</span>
          <span><i class="legend-dot" style="background:#64748b;"></i> Persistence Baseline</span>
        </div>
        <p class="cp-panel-note">Evaluation based on historical consecutive-semester holdouts where both current and next semester are observed.</p>
      </article>
    `;
  }


  /**
   * Dispatches subtab rendering.
   */
  renderActiveSubtab(dataset, overview) {
    switch (this.activeSubtab) {
      case 'transitions':
        return this.renderTransitionsSubtab(dataset, overview);
      case 'distributions':
        return this.renderDistributionsSubtab(dataset, overview);
      case 'evaluation':
        return this.renderEvaluationSubtab(dataset);
      case 'matrix':
        return this.renderMatrixSubtab(dataset);
      case 'candidates':
        return this.renderCandidatesSubtab(dataset);
      default:
        return this.renderTransitionsSubtab(dataset, overview);
    }
  }

  // =========================================================================
  // Sub-Tab 1: Transitions Scatter & In-Sample Residuals
  // =========================================================================
  renderTransitionsSubtab(dataset, overview) {
    const scatter = computeTransitionScatter(dataset);
    const residuals = computeResidualAnalysis(dataset);

    const modelFormula = scatter.regressionModel 
      ? `<code>${this.escapeHtml(scatter.regressionModel.formula)}</code>`
      : `<span style="color: var(--accent-warning);">Regression unavailable (${overview.regressionMessage})</span>`;

    return `
      <!-- Scatter Plot Card -->
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <h3 class="card-title">Consecutive-Semester Transition Dynamics</h3>
            <p class="card-subtitle">
              Prior SGPA (s<sub>t</sub>) versus subsequent SGPA (s<sub>t+1</sub>) for all valid one-step transitions
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: var(--space-sm);">
            <button class="btn btn-secondary" id="btn-toggle-table" style="font-size: 12px; padding: 4px 10px;">
              ${this.showTableView ? '📊 Show Scatter SVG' : '📋 Show Tabular Data'}
            </button>
            <label style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="checkbox" id="chk-persistence-line" ${this.showPersistenceLine ? 'checked' : ''}>
              Show Persistence Line (y = x)
            </label>
          </div>
        </div>

        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: var(--space-sm);">
          Fitted Class-Wide Model: ${modelFormula}
        </div>

        ${this.showTableView 
          ? this.renderScatterTable(scatter) 
          : this.renderScatterSVG(scatter)}

        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-color" style="background-color: #DC2626;"></span>
            <span>Observed Transition Point (n = ${scatter.totalTransitions})</span>
          </div>
          ${scatter.regressionLine ? `
            <div class="legend-item">
              <span class="legend-color" style="background-color: #EF4444; height: 3px;"></span>
              <span>Fitted Class Regression Line (Model B)</span>
            </div>
          ` : ''}
          ${this.showPersistenceLine ? `
            <div class="legend-item">
              <span class="legend-color" style="background-color: #64748B; height: 2px; border-top: 1px dashed #94A3B8;"></span>
              <span>Persistence Baseline (y = x)</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Residual Plot Card -->
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <h3 class="card-title">In-Sample Regression Residuals</h3>
            <p class="card-subtitle">
              Fitted SGPA (ŝ) versus residual error (e<sub>i</sub> = y<sub>i</sub> - ŝ<sub>i</sub>)
            </p>
          </div>
          <span class="badge badge-synthetic">Training Data Fit</span>
        </div>

        ${residuals.hasResiduals ? `
          <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: var(--space-sm);">
            ${residuals.notice}
          </div>
          ${this.renderResidualSVG(residuals)}
          <div style="display: flex; gap: var(--space-lg); flex-wrap: wrap; font-size: 13px; color: var(--text-secondary); margin-top: var(--space-sm);">
            <span>Mean: <strong style="color: var(--text-primary);">${residuals.statistics.mean.toFixed(4)}</strong></span>
            <span>Std Dev: <strong style="color: var(--text-primary);">${residuals.statistics.stdDev.toFixed(4)}</strong></span>
            <span>Median: <strong style="color: var(--text-primary);">${residuals.statistics.median.toFixed(4)}</strong></span>
            <span>IQR: <strong style="color: var(--text-primary);">${residuals.statistics.iqr.toFixed(4)}</strong></span>
            <span>Range: [${residuals.statistics.min.toFixed(3)}, ${residuals.statistics.max.toFixed(3)}]</span>
          </div>
        ` : `
          <p style="color: var(--text-secondary); font-size: 13px;">${residuals.message}</p>
        `}
      </div>

      <!-- Next-Semester Prediction Preview Card -->
      ${this.renderPredictionPreviewCard(dataset, scatter)}
    `;
  }

  /**
   * Renders a live preview card of next-semester prediction for a cohort student.
   */
  renderPredictionPreviewCard(dataset, scatter) {
    if (!dataset || dataset.length === 0) return '';
    const sampleStudent = dataset.find(r => r.student_key === 'SYN_001') || dataset[0];
    const studentHistory = dataset
      .filter(r => r.student_key === sampleStudent.student_key)
      .sort((a, b) => a.semester_no - b.semester_no);
    const lastObs = studentHistory[studentHistory.length - 1];
    const nextSem = lastObs.semester_no + 1;

    let predValue = lastObs.sgpa;
    let modelUsed = 'Model A: Persistence Baseline';
    let isOor = false;

    if (scatter.regressionModel && typeof scatter.regressionModel.slope === 'number') {
      predValue = scatter.regressionModel.intercept + scatter.regressionModel.slope * lastObs.sgpa;
      modelUsed = 'Model B: Class-Wide Linear Transition';
      if (predValue > 4.00 || predValue < 0.00) isOor = true;
    }

    return `
      <div class="card" style="margin-top: var(--space-xl); background: linear-gradient(135deg, rgba(23, 26, 33, 0.95), rgba(30, 20, 25, 0.9)); border: 1px solid rgba(255, 48, 56, 0.35);">
        <div class="card-header">
          <div>
            <span class="badge badge-crimson" style="margin-bottom: 4px;">Next-Semester Prediction Preview</span>
            <h3 class="card-title" style="margin-top: 2px;">Cohort Sample: ${this.escapeHtml(sampleStudent.student_key)}</h3>
            <p class="card-subtitle">Real-time transition model preview for upcoming academic session</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-goto-predictions-preview" style="font-size: 12px;">
            Open Prediction Workspace →
          </button>
        </div>
        <div class="grid grid-cols-4" style="margin-top: var(--space-sm);">
          <div style="background: var(--color-surface); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
            <div class="kpi-label">Latest Observed</div>
            <div class="kpi-value" style="font-size: 22px;">${lastObs.sgpa.toFixed(2)} <span style="font-size: 12px; font-weight: normal; color: var(--color-muted);">(Sem ${lastObs.semester_no})</span></div>
            <div class="kpi-meta">Last recorded GPA</div>
          </div>
          <div style="background: var(--color-surface); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
            <div class="kpi-label">Predicted SGPA</div>
            <div class="kpi-value" style="font-size: 22px; color: ${isOor ? 'var(--color-warning)' : 'var(--color-primary)'};">
              ${predValue.toFixed(2)} <span style="font-size: 12px; font-weight: normal; color: var(--color-muted);">(Sem ${nextSem})</span>
            </div>
            <div class="kpi-meta">Raw unclipped estimate</div>
          </div>
          <div style="background: var(--color-surface); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
            <div class="kpi-label">Model Applied</div>
            <div style="font-size: 13.5px; font-weight: 600; color: var(--color-text); margin-top: 5px;">${modelUsed}</div>
            <div class="kpi-meta">1-step transition rule</div>
          </div>
          <div style="background: var(--color-surface); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
            <div class="kpi-label">Trajectory Status</div>
            <div style="margin-top: 6px;">
              ${isOor 
                ? '<span class="badge badge-warning">⚠️ Out of Range (> 4.00)</span>' 
                : '<span class="badge badge-success">✓ Bounded [0.00 – 4.00]</span>'}
            </div>
            <div class="kpi-meta">${isOor ? 'Extreme trajectory flagged' : 'Within standard bounds'}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generates responsive SVG for Transition Scatter Plot.
   */
  renderScatterSVG(scatter) {
    if (!scatter.hasTransitions || scatter.points.length === 0) {
      return `<p style="color: var(--text-secondary); padding: 20px 0;">No transitions to plot.</p>`;
    }

    const w = 600;
    const h = 380;
    const padL = 50;
    const padR = 25;
    const padT = 20;
    const padB = 45;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const scaleMax = GPA_SCALE_MAX;

    const toX = val => padL + (val / scaleMax) * plotW;
    const toY = val => padT + (1 - val / scaleMax) * plotH;

    // Grid lines & Axis labels
    const ticks = [0, 1, 2, 3, 4];
    const gridLines = ticks.map(t => {
      const x = toX(t);
      const y = toY(t);
      return `
        <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#242430" stroke-width="1" />
        <line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#242430" stroke-width="1" />
        <text x="${x}" y="${padT + plotH + 18}" fill="#94A3B8" font-size="11" text-anchor="middle" font-family="monospace">${t.toFixed(1)}</text>
        <text x="${padL - 10}" y="${y + 4}" fill="#94A3B8" font-size="11" text-anchor="end" font-family="monospace">${t.toFixed(1)}</text>
      `;
    }).join('');

    // Persistence line y = x
    let persistenceLineSvg = '';
    if (this.showPersistenceLine) {
      persistenceLineSvg = `
        <line x1="${toX(0)}" y1="${toY(0)}" x2="${toX(scaleMax)}" y2="${toY(scaleMax)}" 
              stroke="#64748B" stroke-width="1.5" stroke-dasharray="5,4" />
      `;
    }

    // Regression Line y = a + b*x (clipped to [0, scaleMax])
    let regLineSvg = '';
    if (scatter.regressionLine) {
      const x1 = 0;
      const y1 = scatter.regressionLine.y1;
      const x2 = scaleMax;
      const y2 = scatter.regressionLine.y2;

      regLineSvg = `
        <line x1="${toX(x1)}" y1="${toY(y1)}" x2="${toX(x2)}" y2="${toY(y2)}" 
              stroke="#DC2626" stroke-width="2.5" />
      `;
    }

    // Plot circles
    const circles = scatter.points.map(p => {
      const cx = toX(p.x);
      const cy = toY(p.y);
      return `
        <circle cx="${cx}" cy="${cy}" r="5" fill="#EF4444" stroke="#0B0B0E" stroke-width="1.5"
                class="scatter-point" tabindex="0" role="img"
                aria-label="Student ${p.student_key}: Sem ${p.from_semester} (${p.x.toFixed(2)}) to Sem ${p.to_semester} (${p.y.toFixed(2)})"
                data-tooltip="<strong>${p.student_key}</strong> (Sem ${p.from_semester} → ${p.to_semester})<br>Prior SGPA: ${p.x.toFixed(2)}<br>Next SGPA: ${p.y.toFixed(2)}${p.residual !== null ? '<br>Residual: ' + p.residual.toFixed(3) : ''}" />
      `;
    }).join('');

    return `
      <div class="svg-chart-container">
        <svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="xMidYMid meet" role="region" aria-label="Semester Transition Scatter Plot">
          <!-- Bounding Border -->
          <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="#0B0B0E" stroke="#242430" />
          ${gridLines}
          ${persistenceLineSvg}
          ${regLineSvg}
          ${circles}
          <!-- Axis Titles -->
          <text x="${padL + plotW / 2}" y="${h - 8}" fill="#F8FAFC" font-size="12" font-weight="600" text-anchor="middle">
            Previous Semester SGPA (s_{t})
          </text>
          <text x="16" y="${padT + plotH / 2}" fill="#F8FAFC" font-size="12" font-weight="600" text-anchor="middle" transform="rotate(-90 16 ${padT + plotH / 2})">
            Next Semester SGPA (s_{t+1})
          </text>
        </svg>
      </div>
    `;
  }

  /**
   * Generates responsive SVG for In-Sample Residual Plot.
   */
  renderResidualSVG(residuals) {
    const w = 600;
    const h = 280;
    const padL = 50;
    const padR = 25;
    const padT = 20;
    const padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const scaleMax = GPA_SCALE_MAX;

    // Y domain: symmetrical around 0
    const maxAbsRes = Math.max(0.5, Math.abs(residuals.statistics.min), Math.abs(residuals.statistics.max)) * 1.15;
    const toX = val => padL + (val / scaleMax) * plotW;
    const toY = res => padT + plotH / 2 - (res / maxAbsRes) * (plotH / 2);

    // Grid & Axis
    const yTicks = [-maxAbsRes, -maxAbsRes / 2, 0, maxAbsRes / 2, maxAbsRes];
    const gridSvg = yTicks.map(t => {
      const y = toY(t);
      const isZero = Math.abs(t) < 1e-4;
      return `
        <line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" 
              stroke="${isZero ? '#F59E0B' : '#242430'}" stroke-width="${isZero ? 1.5 : 1}" 
              stroke-dasharray="${isZero ? '4,4' : 'none'}" />
        <text x="${padL - 8}" y="${y + 4}" fill="#94A3B8" font-size="10" text-anchor="end" font-family="monospace">${t.toFixed(2)}</text>
      `;
    }).join('');

    // X Ticks
    const xTicksSvg = [0, 1, 2, 3, 4].map(t => {
      const x = toX(t);
      return `
        <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#242430" stroke-width="1" />
        <text x="${x}" y="${padT + plotH + 16}" fill="#94A3B8" font-size="10" text-anchor="middle" font-family="monospace">${t.toFixed(1)}</text>
      `;
    }).join('');

    // Circles
    const circles = residuals.residuals.map(r => {
      const cx = toX(r.predicted_sgpa);
      const cy = toY(r.residual);
      return `
        <circle cx="${cx}" cy="${cy}" r="4.5" fill="#3B82F6" stroke="#0B0B0E" stroke-width="1"
                class="scatter-point" tabindex="0" role="img"
                aria-label="Student ${r.student_key}: Pred ${r.predicted_sgpa.toFixed(2)}, Residual ${r.residual.toFixed(3)}"
                data-tooltip="<strong>${r.student_key}</strong> (Sem ${r.from_semester} → ${r.to_semester})<br>Predicted SGPA: ${r.predicted_sgpa.toFixed(2)}<br>Actual SGPA: ${r.actual_sgpa.toFixed(2)}<br>Residual (e): ${r.residual.toFixed(3)}" />
      `;
    }).join('');

    return `
      <div class="svg-chart-container">
        <svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="xMidYMid meet" role="region" aria-label="In-Sample Residual Plot">
          <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="#0B0B0E" stroke="#242430" />
          ${gridSvg}
          ${xTicksSvg}
          ${circles}
          <text x="${padL + plotW / 2}" y="${h - 6}" fill="#F8FAFC" font-size="11" font-weight="600" text-anchor="middle">
            Fitted Predicted SGPA (ŝ)
          </text>
          <text x="14" y="${padT + plotH / 2}" fill="#F8FAFC" font-size="11" font-weight="600" text-anchor="middle" transform="rotate(-90 14 ${padT + plotH / 2})">
            Residual (e = y - ŝ)
          </text>
        </svg>
      </div>
    `;
  }

  /**
   * Renders tabular alternative for transition scatter data.
   */
  renderScatterTable(scatter) {
    return `
      <div class="table-wrapper" style="margin-bottom: var(--space-md);">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Student Key</th>
              <th>Transition</th>
              <th>Prior SGPA (s<sub>t</sub>)</th>
              <th>Next SGPA (s<sub>t+1</sub>)</th>
              <th>Fitted SGPA (ŝ)</th>
              <th>In-Sample Residual (e)</th>
            </tr>
          </thead>
          <tbody>
            ${scatter.points.map((p, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><code style="color: var(--text-code);">${p.student_key}</code></td>
                <td>Sem ${p.from_semester} → ${p.to_semester}</td>
                <td style="font-family: monospace;">${p.x.toFixed(3)}</td>
                <td style="font-family: monospace;">${p.y.toFixed(3)}</td>
                <td style="font-family: monospace;">${p.predicted_y !== null ? p.predicted_y.toFixed(3) : '-'}</td>
                <td style="font-family: monospace; color: ${p.residual !== null && p.residual < 0 ? '#EF4444' : '#10B981'};">
                  ${p.residual !== null ? (p.residual > 0 ? '+' : '') + p.residual.toFixed(3) : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // =========================================================================
  // Sub-Tab 2: Semester Distributions (Histogram & Boxplot)
  // =========================================================================
  renderDistributionsSubtab(dataset, overview) {
    const dist = computeSemesterDistribution(dataset, this.selectedSemester);

    return `
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <h3 class="card-title">Semester SGPA Distribution</h3>
            <p class="card-subtitle">8-bin histogram and Tukey boxplot for selected semester observations</p>
          </div>
          <!-- Semester Selector Pills -->
          <div class="pill-group" role="tablist" aria-label="Select Semester">
            ${overview.observedSemesters.map(sem => `
              <button class="pill-btn ${sem === this.selectedSemester ? 'active' : ''}" 
                      data-sem="${sem}" role="tab" aria-selected="${sem === this.selectedSemester}">
                Sem ${sem}
              </button>
            `).join('')}
          </div>
        </div>

        ${dist.insufficientData ? `
          <p style="color: var(--text-secondary); padding: var(--space-lg) 0;">${dist.message}</p>
        ` : `
          ${dist.smallSampleNotice ? `
            <div style="padding: 8px 12px; background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); font-size: 12px; color: var(--accent-warning); margin-bottom: var(--space-md);">
              ℹ️ ${dist.smallSampleNotice}
            </div>
          ` : ''}

          <!-- Distribution Summary Metrics -->
          <div style="display: flex; gap: var(--space-lg); flex-wrap: wrap; margin-bottom: var(--space-md); font-size: 13px; color: var(--text-secondary);">
            <span>Count: <strong style="color: var(--text-primary);">${dist.statistics.count}</strong></span>
            <span>Mean: <strong style="color: var(--text-primary);">${dist.statistics.mean.toFixed(3)}</strong></span>
            <span>Std Dev: <strong style="color: var(--text-primary);">${dist.statistics.stdDev.toFixed(3)}</strong></span>
            <span>Median: <strong style="color: var(--text-primary);">${dist.boxplot.median.toFixed(3)}</strong></span>
            <span>IQR: <strong style="color: var(--text-primary);">${dist.boxplot.iqr.toFixed(3)}</strong></span>
            <span>Range: [${dist.statistics.min.toFixed(2)}, ${dist.statistics.max.toFixed(2)}]</span>
          </div>

          <!-- Histogram SVG -->
          <h4 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
            SGPA Frequency Histogram (Bin Width = 0.50)
          </h4>
          ${this.renderHistogramSVG(dist.histogram, dist.observationCount)}

          <!-- Boxplot SVG -->
          <h4 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: var(--space-lg); margin-bottom: 6px;">
            Tukey Boxplot & Outliers
          </h4>
          ${this.renderBoxplotSVG(dist.boxplot)}
        `}
      </div>
    `;
  }

  /**
   * Generates responsive SVG for Histogram.
   */
  renderHistogramSVG(histogram, totalCount) {
    const w = 600;
    const h = 260;
    const padL = 45;
    const padR = 20;
    const padT = 25;
    const padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const maxCount = Math.max(1, histogram.maxBinCount);
    const numBins = histogram.bins.length;
    const barWidth = plotW / numBins;

    const toY = cnt => padT + (1 - cnt / maxCount) * plotH;

    // Y Axis Grid
    const yTicks = [0, Math.ceil(maxCount / 2), maxCount];
    const gridSvg = yTicks.map(t => {
      const y = toY(t);
      return `
        <line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#242430" stroke-width="1" />
        <text x="${padL - 8}" y="${y + 4}" fill="#94A3B8" font-size="10" text-anchor="end" font-family="monospace">${t}</text>
      `;
    }).join('');

    // Bars
    const barsSvg = histogram.bins.map((b, i) => {
      const x = padL + i * barWidth;
      const barH = (b.count / maxCount) * plotH;
      const y = padT + plotH - barH;
      return `
        <rect x="${x + 3}" y="${y}" width="${barWidth - 6}" height="${barH}" 
              fill="#DC2626" rx="2" stroke="#EF4444" stroke-width="1"
              class="scatter-point" tabindex="0" role="img"
              aria-label="Bin ${b.label}: ${b.count} observations"
              data-tooltip="<strong>Bin ${b.label}</strong><br>Count: ${b.count} (${(b.frequency * 100).toFixed(1)}%)" />
        ${b.count > 0 ? `
          <text x="${x + barWidth / 2}" y="${y - 6}" fill="#F8FAFC" font-size="10" font-weight="600" text-anchor="middle">
            ${b.count}
          </text>
        ` : ''}
        <text x="${x + barWidth / 2}" y="${padT + plotH + 16}" fill="#94A3B8" font-size="10" text-anchor="middle" font-family="monospace">
          ${b.min.toFixed(1)}
        </text>
      `;
    }).join('');

    return `
      <div class="svg-chart-container">
        <svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="xMidYMid meet" role="region" aria-label="SGPA Histogram">
          <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="#0B0B0E" stroke="#242430" />
          ${gridSvg}
          ${barsSvg}
          <text x="${padL + plotW}" y="${padT + plotH + 16}" fill="#94A3B8" font-size="10" text-anchor="middle" font-family="monospace">4.0</text>
          <text x="${padL + plotW / 2}" y="${h - 6}" fill="#F8FAFC" font-size="11" font-weight="600" text-anchor="middle">
            Observed SGPA Bins [0.00 – 4.00]
          </text>
          <text x="12" y="${padT + plotH / 2}" fill="#F8FAFC" font-size="11" font-weight="600" text-anchor="middle" transform="rotate(-90 12 ${padT + plotH / 2})">
            Count (n = ${totalCount})
          </text>
        </svg>
      </div>
    `;
  }

  /**
   * Generates responsive SVG for Tukey Boxplot.
   */
  renderBoxplotSVG(bp) {
    const w = 600;
    const h = 130;
    const padL = 45;
    const padR = 20;
    const padT = 20;
    const padB = 30;
    const plotW = w - padL - padR;
    const boxY = padT + 25;
    const boxH = 40;
    const midY = boxY + boxH / 2;
    const scaleMax = GPA_SCALE_MAX;

    const toX = val => padL + (val / scaleMax) * plotW;

    const xQ1 = toX(bp.q1);
    const xMed = toX(bp.median);
    const xQ3 = toX(bp.q3);
    const xLowW = toX(bp.lowerWhisker);
    const xUppW = toX(bp.upperWhisker);

    // Axis Ticks
    const ticksSvg = [0, 1, 2, 3, 4].map(t => {
      const x = toX(t);
      return `
        <line x1="${x}" y1="${padT + 10}" x2="${x}" y2="${boxY + boxH + 15}" stroke="#242430" stroke-width="1" />
        <text x="${x}" y="${boxY + boxH + 28}" fill="#94A3B8" font-size="10" text-anchor="middle" font-family="monospace">${t.toFixed(1)}</text>
      `;
    }).join('');

    // Outlier points
    const outlierSvg = bp.outliers.map(o => {
      const cx = toX(o.sgpa);
      return `
        <circle cx="${cx}" cy="${midY}" r="4.5" fill="#F59E0B" stroke="#0B0B0E" stroke-width="1.5"
                class="scatter-point" tabindex="0" role="img"
                aria-label="Outlier: ${o.student_key} SGPA ${o.sgpa.toFixed(2)}"
                data-tooltip="<strong>Outlier: ${o.student_key}</strong><br>SGPA: ${o.sgpa.toFixed(2)} (${o.position})<br>Deviation from Whisker: ${o.deviation.toFixed(3)}" />
      `;
    }).join('');

    return `
      <div class="svg-chart-container">
        <svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="xMidYMid meet" role="region" aria-label="Tukey Boxplot">
          ${ticksSvg}
          <!-- Whisker Line -->
          <line x1="${xLowW}" y1="${midY}" x2="${xUppW}" y2="${midY}" stroke="#94A3B8" stroke-width="2" />
          <!-- Lower Whisker Cap -->
          <line x1="${xLowW}" y1="${midY - 10}" x2="${xLowW}" y2="${midY + 10}" stroke="#94A3B8" stroke-width="2" />
          <!-- Upper Whisker Cap -->
          <line x1="${xUppW}" y1="${midY - 10}" x2="${xUppW}" y2="${midY + 10}" stroke="#94A3B8" stroke-width="2" />
          <!-- IQR Box -->
          <rect x="${xQ1}" y="${boxY}" width="${Math.max(2, xQ3 - xQ1)}" height="${boxH}" 
                fill="rgba(220, 38, 38, 0.25)" stroke="#DC2626" stroke-width="2" rx="2" />
          <!-- Median Line -->
          <line x1="${xMed}" y1="${boxY}" x2="${xMed}" y2="${boxY + boxH}" stroke="#FFFFFF" stroke-width="2.5" />
          ${outlierSvg}
          <!-- Labels -->
          <text x="${xMed}" y="${boxY - 6}" fill="#FFFFFF" font-size="10" font-weight="700" text-anchor="middle">
            Med ${bp.median.toFixed(2)}
          </text>
        </svg>
      </div>
    `;
  }

  // =========================================================================
  // Sub-Tab 3: Historical Temporal Evaluation (Holdout Comparison)
  // =========================================================================
  renderEvaluationSubtab(dataset) {
    const evalData = computeDashboardTemporalEvaluation(dataset);

    if (!evalData.evaluationAvailable) {
      return `
        <div class="chart-card">
          <div class="chart-header">
            <div>
              <h3 class="card-title">Rolling-Origin Temporal Evaluation</h3>
              <p class="card-subtitle">Expanding-window chronological backtesting against Persistence Baseline</p>
            </div>
            <span class="badge badge-synthetic">Status: ${evalData.status}</span>
          </div>
          <div style="padding: var(--space-lg) 0; color: var(--text-secondary); font-size: 13px;">
            <p>${evalData.message}</p>
          </div>
        </div>
      `;
    }

    const m = evalData.pairedMetrics;
    const isBeating = m.regressionBeatsBaseline;
    const conclusionBadge = isBeating 
      ? '<span class="badge badge-success">✓ Linear Regression Beats Baseline</span>'
      : '<span class="badge badge-warning">⚠️ Persistence Baseline Outperforms Regression</span>';

    return `
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <h3 class="card-title">Historical Temporal Evaluation Evidence (Phase 5)</h3>
            <p class="card-subtitle">
              Strict expanding-window cross-validation evaluated over paired test transitions (n = ${evalData.pairedComparisonCount})
            </p>
          </div>
          ${conclusionBadge}
        </div>

        <!-- Paired Error Metric Cards -->
        <div class="kpi-grid" style="margin-bottom: var(--space-lg);">
          <div class="kpi-card">
            <div class="kpi-label">Regression MAE (Paired)</div>
            <div class="kpi-value" style="color: ${isBeating ? '#10B981' : '#F59E0B'};">
              ${m.regressionMae.toFixed(4)}
            </div>
            <div class="kpi-meta">Lower is better</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Persistence MAE (Paired)</div>
            <div class="kpi-value">${m.baselineMae.toFixed(4)}</div>
            <div class="kpi-meta">Baseline null hypothesis</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">MAE Delta (Improvement)</div>
            <div class="kpi-value" style="color: ${m.deltaMaePct > 0 ? '#10B981' : '#EF4444'};">
              ${m.deltaMaePct > 0 ? '+' : ''}${m.deltaMaePct.toFixed(2)}%
            </div>
            <div class="kpi-meta">${m.deltaMaePct > 0 ? 'Regression lower error' : 'Regression higher error'}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Regression RMSE (Pooled)</div>
            <div class="kpi-value">${m.regressionRmse.toFixed(4)}</div>
            <div class="kpi-meta">Pooled over paired observations</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Baseline RMSE (Pooled)</div>
            <div class="kpi-value">${m.baselineRmse.toFixed(4)}</div>
            <div class="kpi-meta">Pooled baseline RMSE</div>
          </div>
        </div>

        <!-- Side-by-Side SVG Comparison Bar Chart -->
        <h4 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
          Model Error Comparison: Regression vs. Persistence
        </h4>
        ${this.renderEvaluationBarChartSVG(m)}

        <!-- Per-Fold Breakdown Table -->
        <h4 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: var(--space-xl); margin-bottom: 8px;">
          Chronological Fold Breakdown
        </h4>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Target Semester</th>
                <th>Training Transitions</th>
                <th>Test Transitions</th>
                <th>Paired Comparisons</th>
                <th>Regression MAE</th>
                <th>Baseline MAE</th>
                <th>Δ MAE %</th>
                <th>Fold Status</th>
              </tr>
            </thead>
            <tbody>
              ${evalData.folds.map(f => `
                <tr>
                  <td><strong>Semester ${f.targetSemester}</strong></td>
                  <td style="font-family: monospace;">${f.trainingCount}</td>
                  <td style="font-family: monospace;">${f.testCount}</td>
                  <td style="font-family: monospace;">${f.pairedCount}</td>
                  <td style="font-family: monospace;">${f.regressionMae !== null ? f.regressionMae.toFixed(4) : '-'}</td>
                  <td style="font-family: monospace;">${f.baselineMae !== null ? f.baselineMae.toFixed(4) : '-'}</td>
                  <td style="font-family: monospace; color: ${f.deltaMaePct !== null && f.deltaMaePct > 0 ? '#10B981' : '#EF4444'};">
                    ${f.deltaMaePct !== null ? (f.deltaMaePct > 0 ? '+' : '') + f.deltaMaePct.toFixed(2) + '%' : '-'}
                  </td>
                  <td>
                    ${f.status === 'EVALUATED' 
                      ? '<span class="badge badge-success">Evaluated</span>'
                      : `<span class="badge badge-warning">${f.status}</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Generates responsive SVG for paired MAE and RMSE comparison bars.
   */
  renderEvaluationBarChartSVG(m) {
    const w = 600;
    const h = 200;
    const padL = 70;
    const padR = 30;
    const padT = 20;
    const padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const maxVal = Math.max(m.regressionMae, m.baselineMae, m.regressionRmse, m.baselineRmse) * 1.25;
    const toY = val => padT + (1 - val / maxVal) * plotH;

    // 2 Groups: MAE and RMSE
    const groupW = plotW / 2;
    const barW = 45;

    // Group 1: MAE
    const xRegMae = padL + groupW * 0.25 - barW / 2;
    const xBaseMae = padL + groupW * 0.75 - barW / 2;

    // Group 2: RMSE
    const xRegRmse = padL + groupW + groupW * 0.25 - barW / 2;
    const xBaseRmse = padL + groupW + groupW * 0.75 - barW / 2;

    const yRegMae = toY(m.regressionMae);
    const yBaseMae = toY(m.baselineMae);
    const yRegRmse = toY(m.regressionRmse);
    const yBaseRmse = toY(m.baselineRmse);

    return `
      <div class="svg-chart-container">
        <svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="xMidYMid meet" role="region" aria-label="Paired Error Comparison Chart">
          <!-- Grid -->
          <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#242430" stroke-width="1" />
          
          <!-- MAE Bars -->
          <rect x="${xRegMae}" y="${yRegMae}" width="${barW}" height="${padT + plotH - yRegMae}" 
                fill="${m.regressionMae < m.baselineMae ? '#10B981' : '#EF4444'}" rx="3" />
          <text x="${xRegMae + barW / 2}" y="${yRegMae - 5}" fill="#F8FAFC" font-size="10" font-weight="600" text-anchor="middle">
            ${m.regressionMae.toFixed(3)}
          </text>
          
          <rect x="${xBaseMae}" y="${yBaseMae}" width="${barW}" height="${padT + plotH - yBaseMae}" 
                fill="#64748B" rx="3" />
          <text x="${xBaseMae + barW / 2}" y="${yBaseMae - 5}" fill="#F8FAFC" font-size="10" font-weight="600" text-anchor="middle">
            ${m.baselineMae.toFixed(3)}
          </text>

          <!-- Group 1 Label -->
          <text x="${padL + groupW / 2}" y="${h - 10}" fill="#F8FAFC" font-size="12" font-weight="600" text-anchor="middle">
            Mean Absolute Error (MAE)
          </text>

          <!-- Divider -->
          <line x1="${padL + groupW}" y1="${padT}" x2="${padL + groupW}" y2="${padT + plotH}" stroke="#242430" stroke-width="1" stroke-dasharray="3,3" />

          <!-- RMSE Bars -->
          <rect x="${xRegRmse}" y="${yRegRmse}" width="${barW}" height="${padT + plotH - yRegRmse}" 
                fill="${m.regressionRmse < m.baselineRmse ? '#10B981' : '#EF4444'}" rx="3" />
          <text x="${xRegRmse + barW / 2}" y="${yRegRmse - 5}" fill="#F8FAFC" font-size="10" font-weight="600" text-anchor="middle">
            ${m.regressionRmse.toFixed(3)}
          </text>

          <rect x="${xBaseRmse}" y="${yBaseRmse}" width="${barW}" height="${padT + plotH - yBaseRmse}" 
                fill="#64748B" rx="3" />
          <text x="${xBaseRmse + barW / 2}" y="${yBaseRmse - 5}" fill="#F8FAFC" font-size="10" font-weight="600" text-anchor="middle">
            ${m.baselineRmse.toFixed(3)}
          </text>

          <!-- Group 2 Label -->
          <text x="${padL + groupW + groupW / 2}" y="${h - 10}" fill="#F8FAFC" font-size="12" font-weight="600" text-anchor="middle">
            Root Mean Squared Error (RMSE)
          </text>
        </svg>
      </div>
      <div class="chart-legend" style="margin-top: 4px;">
        <div class="legend-item">
          <span class="legend-color" style="background-color: #10B981;"></span>
          <span>Regression (Superior)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #EF4444;"></span>
          <span>Regression (Higher Error)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #64748B;"></span>
          <span>Persistence Baseline</span>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // Sub-Tab 4: Transition Matrix
  // =========================================================================
  renderMatrixSubtab(dataset) {
    const matrixResult = computeTransitionMatrix(dataset);

    if (!matrixResult.hasTransitions) {
      return `
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="card-title">Dataset Transition Summary Matrix</h3>
          </div>
          <p style="color: var(--text-secondary); font-size: 13px;">${matrixResult.message}</p>
        </div>
      `;
    }

    return `
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <h3 class="card-title">Dataset Transition Availability Matrix</h3>
            <p class="card-subtitle">
              Tabulates valid consecutive transitions (s<sub>t</sub> → s<sub>t+1</sub>) vs. non-consecutive gaps
            </p>
          </div>
          <span class="badge badge-success">Total Transitions: ${matrixResult.totalConsecutiveTransitions}</span>
        </div>

        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: var(--space-md);">
          Rows represent the source semester (s<sub>t</sub>), and columns represent the target semester (s<sub>t+1</sub>).
          Under ClassPredict's non-bridging rule, only consecutive 1-step pairs are valid; non-consecutive jumps (e.g. Sem 1 → Sem 3) are strictly excluded from regression models.
        </div>

        <div class="matrix-wrapper">
          <table class="matrix-table">
            <thead>
              <tr>
                <th style="text-align: left;">From \\ To</th>
                ${matrixResult.semesters.map(s => `<th>Sem ${s}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${matrixResult.matrix.map(row => `
                <tr>
                  <th style="text-align: left; background-color: var(--bg-card);">Sem ${row.fromSemester}</th>
                  ${row.cells.map(cell => {
                    if (cell.isConsecutive) {
                      return `
                        <td class="matrix-cell-consecutive" title="${this.escapeHtml(cell.description)}">
                          ${cell.count}
                        </td>
                      `;
                    } else if (cell.status === 'GAP_SKIPPED') {
                      return `
                        <td class="matrix-cell-gap" title="${this.escapeHtml(cell.description)}">
                          Gap (0)
                        </td>
                      `;
                    } else {
                      return `
                        <td class="matrix-cell-disabled" title="${this.escapeHtml(cell.description)}">
                          —
                        </td>
                      `;
                    }
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-color" style="background-color: rgba(220, 38, 38, 0.4); border: 1px solid var(--accent-primary);"></span>
            <span>Valid Consecutive Transition (Eligible for Modeling)</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background-color: rgba(30, 30, 40, 0.4); border: 1px dashed #64748B;"></span>
            <span>Non-Consecutive Semester Gap (Excluded by Non-Bridging Policy)</span>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // Sub-Tab 5: Review Candidates (Potentially Unusual Observations)
  // =========================================================================
  renderCandidatesSubtab(dataset) {
    const detection = detectUnusualObservations(dataset);

    return `
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <h3 class="card-title">Potentially Unusual Observations (Review Candidates)</h3>
            <p class="card-subtitle">
              Deterministic 1.5x IQR statistical evaluation across observed distributions and in-sample residuals
            </p>
          </div>
          <span class="badge badge-warning">${detection.totalCandidates} Review Candidates</span>
        </div>

        <div style="background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-lg); font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
          <strong style="color: var(--accent-warning);">Auditor Guidelines & Ethical Boundary:</strong><br>
          ${detection.safetyNotice} Flagged entries represent mathematical outliers relative to the cohort distribution. They are intended for transcription verification and must <strong>never</strong> be altered or purged without independent institutional cause.
        </div>

        ${detection.totalCandidates === 0 ? `
          <p style="color: var(--text-secondary); font-size: 13px; padding: var(--space-md) 0;">
            ✓ No observations exceed the 1.5x IQR threshold. All points fall within expected cohort variance bounds.
          </p>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student Key</th>
                  <th>Category</th>
                  <th>Context</th>
                  <th>Observed Value</th>
                  <th>Expected Bounds</th>
                  <th>Severity Tag</th>
                  <th>Auditor Guidance</th>
                </tr>
              </thead>
              <tbody>
                ${detection.candidates.map((c, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><code style="color: var(--text-code);">${c.student_key}</code></td>
                    <td>${c.type === 'SEMESTER_SGPA_OUTLIER' ? 'Semester Distribution' : 'Transition Residual'}</td>
                    <td>${c.context}</td>
                    <td style="font-family: monospace; font-weight: 700;">${c.observedValue.toFixed(2)} ${c.metricUnit}</td>
                    <td style="font-family: monospace; font-size: 12px; color: var(--text-tertiary);">
                      [${c.lowerThreshold.toFixed(2)}, ${c.upperThreshold.toFixed(2)}]
                    </td>
                    <td>
                      <span class="badge ${c.severity.includes('LOW') || c.severity.includes('NEGATIVE') ? 'badge-warning' : 'badge-crimson'}">
                        ${c.severity}
                      </span>
                    </td>
                    <td style="font-size: 12px; max-width: 280px; color: var(--text-secondary);">
                      ${this.escapeHtml(c.guidance)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  /**
   * Binds user interactions and tab switching.
   */
  bindEvents() {
    // Sub-tab navigation
    const subtabButtons = this.container.querySelectorAll('.subtab-btn');
    subtabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-subtab');
        if (target && target !== this.activeSubtab) {
          this.activeSubtab = target;
          this.render();
          this.bindEvents();
        }
      });
    });

    // Semester pills (Distributions)
    const semPills = this.container.querySelectorAll('.pill-btn');
    semPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const sem = Number(pill.getAttribute('data-sem'));
        if (sem && sem !== this.selectedSemester) {
          this.selectedSemester = sem;
          this.render();
          this.bindEvents();
        }
      });
    });

    // Toggle table view
    const btnToggleTable = this.container.querySelector('#btn-toggle-table');
    if (btnToggleTable) {
      btnToggleTable.addEventListener('click', () => {
        this.showTableView = !this.showTableView;
        this.render();
        this.bindEvents();
      });
    }

    // Toggle persistence line
    const chkPersistence = this.container.querySelector('#chk-persistence-line');
    if (chkPersistence) {
      chkPersistence.addEventListener('change', (e) => {
        this.showPersistenceLine = e.target.checked;
        this.render();
        this.bindEvents();
      });
    }

    // Overview grid button listeners
    const btnHeroLoadDataset = this.container.querySelector('#btn-hero-load-dataset');
    if (btnHeroLoadDataset) {
      btnHeroLoadDataset.addEventListener('click', () => {
        const datasetNav = document.querySelector('[data-nav-id="dataset"]') || document.getElementById('tab-btn-dataset');
        if (datasetNav) datasetNav.click();
      });
    }

    const btnPreviewViewAll = this.container.querySelector('#btn-preview-view-all');
    if (btnPreviewViewAll) {
      btnPreviewViewAll.addEventListener('click', () => {
        const classNav = document.querySelector('[data-nav-id="class"]') || document.getElementById('tab-btn-predictions');
        if (classNav) classNav.click();
      });
    }

    const semSelect = this.container.querySelector('#dashboard-semester-select');
    if (semSelect) {
      semSelect.addEventListener('change', (e) => {
        this.selectedSemester = e.target.value;
        this.render();
        this.bindEvents();
      });
    }

    // Prediction preview navigation button
    const btnGotoPredPreview = this.container.querySelector('#btn-goto-predictions-preview');
    if (btnGotoPredPreview) {
      btnGotoPredPreview.addEventListener('click', () => {
        const predTab = document.querySelector('[data-nav-id="individual"]') || document.getElementById('tab-btn-predictions');
        if (predTab) predTab.click();
      });
    }

    const loadDemoCohort = async () => {
      try {
        const res = await fetch('samples/sample_class_sgpa.csv');
        const text = await res.text();
        stateManager.loadCSV(text);
        stateManager.acceptStagedDataset();
      } catch {
        const sample = `student_key,semester_no,sgpa\nSYN_001,1,3.45\nSYN_001,2,3.52\nSYN_001,3,3.60\nSYN_001,4,3.65\nSYN_002,1,2.80\nSYN_002,2,2.95\nSYN_002,3,3.10\nSYN_002,4,3.15\nSYN_003,1,3.75\nSYN_003,2,3.80\nSYN_003,3,3.85\nSYN_003,4,3.90\nSYN_004,1,3.10\nSYN_004,2,3.20\nSYN_004,3,3.35\nSYN_004,4,3.40`;
        stateManager.loadCSV(sample);
        stateManager.acceptStagedDataset();
      }
    };

    const btnHeroDemoLoad = this.container.querySelector('#btn-hero-demo-load');
    if (btnHeroDemoLoad) btnHeroDemoLoad.addEventListener('click', loadDemoCohort);

    // Empty state buttons
    const btnDemoLoad = this.container.querySelector('#btn-demo-load');
    if (btnDemoLoad) {
      btnDemoLoad.addEventListener('click', loadDemoCohort);
    }

    const btnGotoDataset = this.container.querySelector('#btn-goto-dataset');
    if (btnGotoDataset) {
      btnGotoDataset.addEventListener('click', () => {
        const datasetTab = document.querySelector('[data-nav-id="dataset"]') || document.getElementById('tab-btn-dataset');
        if (datasetTab) datasetTab.click();
      });
    }

    const btnGotoOcr = this.container.querySelector('#btn-goto-ocr');
    if (btnGotoOcr) {
      btnGotoOcr.addEventListener('click', () => {
        const ocrTab = document.querySelector('[data-nav-id="ocr"]') || document.getElementById('tab-btn-ocr');
        if (ocrTab) ocrTab.click();
      });
    }

    // Tooltip setup
    const tooltip = this.container.querySelector('#chart-tooltip');
    const hoverPoints = this.container.querySelectorAll('.scatter-point');

    hoverPoints.forEach(pt => {
      pt.addEventListener('mouseenter', (e) => {
        const content = pt.getAttribute('data-tooltip');
        if (content && tooltip) {
          tooltip.innerHTML = content;
          tooltip.style.display = 'block';
          const rect = pt.getBoundingClientRect();
          const containerRect = this.container.getBoundingClientRect();
          tooltip.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
          tooltip.style.top = `${rect.top - containerRect.top}px`;
        }
      });

      pt.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.style.display = 'none';
      });

      pt.addEventListener('focus', () => {
        const content = pt.getAttribute('data-tooltip');
        if (content && tooltip) {
          tooltip.innerHTML = content;
          tooltip.style.display = 'block';
          const rect = pt.getBoundingClientRect();
          const containerRect = this.container.getBoundingClientRect();
          tooltip.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
          tooltip.style.top = `${rect.top - containerRect.top}px`;
        }
      });

      pt.addEventListener('blur', () => {
        if (tooltip) tooltip.style.display = 'none';
      });
    });
  }

  /**
   * Escapes HTML entities to prevent XSS.
   */
  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
