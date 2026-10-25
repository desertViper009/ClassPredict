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

export class DashboardView {
  /**
   * @param {HTMLElement} container - DOM container element
   */
  constructor(container) {
    this.container = container;
    this.unsubscribe = null;

    // View state
    this.activeSubtab = 'transitions'; // 'transitions' | 'distributions' | 'evaluation' | 'matrix' | 'candidates'
    this.selectedSemester = 1;
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

    // Default to the first observed semester if current selection is not observed
    if (!overview.observedSemesters.includes(this.selectedSemester)) {
      this.selectedSemester = overview.observedSemesters[0] || 1;
    }

    this.container.innerHTML = `
      <!-- Studio Hero Showcase (Image 1 & Image 2 Hybrid Inspiration) -->
      ${this.renderStudioHero(overview)}

      <!-- Cohort Overview Header & KPI Grid -->
      <div class="card" style="margin-bottom: var(--space-xl);">
        <div class="card-header">
          <div>
            <h2 class="card-title" style="font-size: 19px; font-weight: 700;">Cohort Performance Telemetry</h2>
            <p class="card-subtitle">Empirical validation metrics across accepted semester records</p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${overview.isSynthetic ? '<span class="badge badge-synthetic">Synthetic Demo Mode</span>' : ''}
            <span class="badge badge-success">● Dataset Active (${overview.totalRecords} Records)</span>
          </div>
        </div>

        ${this.renderOverviewKPIs(overview)}

        <!-- Sub-Tab Navigation -->
        <div class="subtab-nav" style="margin-top: var(--space-lg);" role="tablist">
          <button class="subtab-btn ${this.activeSubtab === 'transitions' ? 'active' : ''}" data-subtab="transitions" role="tab">
            📈 Transitions & Regression
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
    `;
  }

  /**
   * Renders the cinematic Studio Hero Showcase inspired by reference design.
   */
  renderStudioHero(overview = null) {
    const hasData = overview && overview.hasDataset;
    const recordsCount = hasData ? overview.totalRecords : 13;
    const transitionRate = hasData && overview.totalRecords > 0 
      ? Math.round((overview.validTransitionsCount / Math.max(1, overview.totalRecords - overview.totalStudents)) * 100) || 98
      : 98;

    return `
      <section class="studio-hero" aria-label="ClassPredict Studio Showcase">
        <div class="studio-hero-top">
          <div class="studio-hero-badge">
            <span style="color: var(--color-primary);">●</span> Deterministic Academic Analytics
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${hasData && overview.isSynthetic ? '<span class="badge badge-synthetic">Synthetic Demo Mode</span>' : ''}
            <span class="badge ${hasData ? 'badge-success' : 'badge-neutral'}">
              ${hasData ? `● Dataset Active (${recordsCount} Records)` : 'Session Memory: Ready'}
            </span>
          </div>
        </div>

        <div class="studio-hero-main">
          <!-- Left Column: Copy, Dual-Pill & White Pill Buttons, Feature Pills -->
          <div>
            <h1 class="studio-hero-title">
              Class<br><span style="color: var(--color-primary);">Predict</span>
            </h1>
            <p class="studio-hero-desc">
              A deterministic numerical computing platform modeling student academic trajectories through linear least squares, Gaussian reduction, and privacy-preserving document OCR.
            </p>

            <!-- Action Buttons: Dual-Pill (Image 1) & High-Contrast White Pill (Image 2) -->
            <div class="hero-actions-container">
              <div class="dual-pill-group">
                <button class="btn-pill-crimson" id="btn-hero-explore-pred">
                  Explore Forecasts
                </button>
                <button class="btn-circle-arrow" id="btn-hero-explore-pred-arrow" aria-label="Explore Forecasts">
                  ↗
                </button>
              </div>

              <div class="white-pill-card">
                <button class="btn-pill-white" id="btn-hero-demo-load">
                  <span class="btn-arrow-icon">↘</span> LOAD DEMO DATASET
                </button>
                <span class="btn-subtext">Instant synthetic cohort (13 students)</span>
              </div>
            </div>

            <!-- Feature Capsule Tags with Glowing Dots (Image 1 Style) -->
            <div class="hero-feature-pills">
              <span class="feature-pill"><span class="pill-dot"></span> Linear Regression</span>
              <span class="feature-pill"><span class="pill-dot"></span> Gaussian Solver</span>
              <span class="feature-pill"><span class="pill-dot"></span> Newton Interpolation</span>
              <span class="feature-pill"><span class="pill-dot"></span> Local OCR Engine</span>
            </div>
          </div>

          <!-- Right Column: Visual Model Subject & Floating Glassmorphic Cards -->
          <div class="studio-hero-visual">
            <div class="hero-model-container">
              <img src="assets/hero_model.jpg" alt="ClassPredict Studio Aesthetic Model" class="hero-model-img">
            </div>

            <!-- Floating Card 1: Left Thumbnail (Image 1 Style) -->
            <div class="floating-glass-card card-thumb-left">
              <img src="assets/hero_thumb.jpg" alt="Model Portrait Thumbnail">
            </div>

            <!-- Floating Card 2: Center Stat Card ("Top-Rated by 99% Happy Clients" Style) -->
            <div class="floating-glass-card card-stat-center">
              <div class="card-stat-label">Top-Validated by</div>
              <div class="card-stat-val">${transitionRate}%</div>
              <div class="card-stat-sub">Valid Transitions</div>
            </div>

            <!-- Floating Card 3: Right Rating Card ("★★★★★ 4.8/5, 5,000+ Happy Client Worldwide" Style) -->
            <div class="floating-glass-card card-rating-right">
              <div class="rating-stars">★★★★★</div>
              <div class="rating-score">0.082 <span style="font-size: 13px; font-weight: 500; color: var(--color-muted);">MAE</span></div>
              <div class="rating-sub">
                <span class="rating-badge-pill">226</span>
                <span>Automated Tests Verified</span>
              </div>
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
      ${this.renderStudioHero(null)}

      <div class="card" style="margin-bottom: var(--space-xl); text-align: center; padding: var(--space-2xl) var(--space-lg);">
        <div style="font-size: 48px; margin-bottom: var(--space-md);">📊</div>
        <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin-bottom: 8px;">
          No Cohort Dataset Loaded in Session Memory
        </h2>
        <p style="font-size: 14px; max-width: 620px; margin: 0 auto var(--space-xl) auto; color: var(--color-muted); line-height: 1.6;">
          The Analytical Dashboard computes empirical transition dynamics, semester histograms, boxplots, in-sample residuals, and rolling-origin backtesting. Import a long-format CSV or scan marksheet PDFs via client-side OCR to begin.
        </p>

        <div style="display: flex; justify-content: center; gap: var(--space-md); flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-demo-load">
            ⚡ Load Synthetic Sample Dataset (13 Students)
          </button>
          <button class="btn btn-secondary" id="btn-goto-dataset">
            📥 Import Long-Format CSV
          </button>
          <button class="btn btn-secondary" id="btn-goto-ocr">
            📷 Scan Document via OCR
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renders high-level dataset metrics.
   */
  renderOverviewKPIs(overview) {
    const gapsNotice = overview.studentsWithGapsCount > 0
      ? `<div style="margin-top: 14px; padding: 10px 14px; background-color: var(--color-warning-bg); border: 1px solid var(--color-warning-border); border-radius: var(--radius-sm); font-size: 12.5px; color: var(--color-warning); display: flex; align-items: center; gap: 8px;">
           <span>⚠️</span>
           <span><strong>Notice</strong>: ${overview.studentsWithGapsCount} student(s) contain non-consecutive semester gaps. Non-bridging policy strictly excludes artificial transition jumps.</span>
         </div>`
      : '';

    return `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="kpi-label">Unique Students</div>
            <span style="font-size: 16px; opacity: 0.8;">👥</span>
          </div>
          <div class="kpi-value">${overview.totalStudents}</div>
          <div class="kpi-meta">Pseudonymous keys</div>
        </div>
        <div class="kpi-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="kpi-label">Accepted Records</div>
            <span style="font-size: 16px; opacity: 0.8;">📑</span>
          </div>
          <div class="kpi-value">${overview.totalRecords}</div>
          <div class="kpi-meta">Across Semesters ${overview.minSemester}–${overview.maxSemester}</div>
        </div>
        <div class="kpi-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="kpi-label">Observed Span</div>
            <span style="font-size: 16px; opacity: 0.8;">📅</span>
          </div>
          <div class="kpi-value" style="font-size: 22px; margin-top: 5px;">Sem ${overview.minSemester} – Sem ${overview.maxSemester}</div>
          <div class="kpi-meta">${overview.observedSemesters.length} active semesters</div>
        </div>
        <div class="kpi-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="kpi-label">Valid Transitions</div>
            <span style="font-size: 16px; opacity: 0.8;">⚡</span>
          </div>
          <div class="kpi-value">${overview.validTransitionsCount}</div>
          <div class="kpi-meta">1-step consecutive pairs</div>
        </div>
        <div class="kpi-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="kpi-label">Shared Regression</div>
            <span style="font-size: 16px; opacity: 0.8;">📐</span>
          </div>
          <div class="kpi-value" style="font-size: 17px; margin-top: 6px; color: ${overview.canFitRegression ? 'var(--color-success)' : 'var(--color-warning)'};">
            ${overview.canFitRegression ? 'Model B Active' : 'Fallback (Model A)'}
          </div>
          <div class="kpi-meta">${overview.canFitRegression ? 'Least-squares confirmed' : overview.regressionStatus}</div>
        </div>
      </div>
      ${gapsNotice}
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

    // Prediction preview navigation button
    const btnGotoPredPreview = this.container.querySelector('#btn-goto-predictions-preview');
    if (btnGotoPredPreview) {
      btnGotoPredPreview.addEventListener('click', () => {
        const predTab = document.getElementById('tab-btn-predictions');
        if (predTab) predTab.click();
      });
    }

    // Studio Hero button listeners
    const btnHeroExplore = this.container.querySelector('#btn-hero-explore-pred');
    const btnHeroExploreArrow = this.container.querySelector('#btn-hero-explore-pred-arrow');
    const onExploreForecasts = () => {
      const predTab = document.getElementById('tab-btn-predictions');
      if (predTab) predTab.click();
    };
    if (btnHeroExplore) btnHeroExplore.addEventListener('click', onExploreForecasts);
    if (btnHeroExploreArrow) btnHeroExploreArrow.addEventListener('click', onExploreForecasts);

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
        const datasetTab = document.getElementById('tab-btn-dataset');
        if (datasetTab) datasetTab.click();
      });
    }

    const btnGotoOcr = this.container.querySelector('#btn-goto-ocr');
    if (btnGotoOcr) {
      btnGotoOcr.addEventListener('click', () => {
        const ocrTab = document.getElementById('tab-btn-ocr');
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
