/**
 * @file numerical_lab_view.js
 * @description Interactive UI Presentation View for Phase 9: Numerical Methods Educational Laboratory.
 * Implements interactive step-by-step Gaussian elimination matrix animator, linear vs. quadratic
 * least-squares comparison, Newton divided-difference table explorer, and Runge phenomenon demo.
 * Document Reference: docs/UI_UX_DESIGN.md, docs/NUMERICAL_MODEL.md, docs/REQUIREMENTS.md (FR-07)
 */

import { 
  GAUSSIAN_EXAMPLES,
  runGaussianEliminationExperiment,
  REGRESSION_LAB_DATASETS,
  fitLinearAndQuadraticRegression,
  extractTransitionsForLab,
  INTERPOLATION_EXAMPLES,
  runNewtonInterpolationExperiment,
  runRungeExperiment,
  NUMERICAL_STABILITY_TOPICS
} from '../core/numerical_lab.js';
import { stateManager } from '../services/state_manager.js';

export class NumericalLabView {
  constructor(container) {
    if (!container) {
      throw new Error("NumericalLabView requires a valid DOM container.");
    }
    this.container = container;
    this.activeSubTab = 'exp-a'; // 'exp-a' | 'exp-b' | 'exp-c' | 'exp-d' | 'topics'

    // Experiment A state
    this.gaussExampleKey = 'standard_3x3';
    this.gaussA = GAUSSIAN_EXAMPLES.standard_3x3.A.map(row => [...row]);
    this.gaussB = [...GAUSSIAN_EXAMPLES.standard_3x3.b];
    this.gaussResult = runGaussianEliminationExperiment(this.gaussA, this.gaussB);
    this.gaussStepIndex = 0;

    // Experiment B state
    this.regDatasetKey = 'parabolic_dip_recovery';
    this.regResult = null;
    this.regTableView = false;

    // Experiment C state
    this.interpExampleKey = 'student_trajectory_4pt';
    this.interpX = [...INTERPOLATION_EXAMPLES.student_trajectory_4pt.x];
    this.interpY = [...INTERPOLATION_EXAMPLES.student_trajectory_4pt.y];
    this.interpXEval = INTERPOLATION_EXAMPLES.student_trajectory_4pt.xEval;
    this.interpResult = null;
    this.interpTableView = false;

    // Experiment D state
    this.rungeNodes = 7;
    this.rungeDist = 'equally_spaced';
    this.rungeResult = null;
    this.rungeTableView = false;

    this.unsubscribeState = null;
  }

  init() {
    this.unsubscribeState = stateManager.subscribe(() => {
      // Re-evaluate if dataset transitions are used in Experiment B
      if (this.regDatasetKey === 'cohort_transitions' && this.activeSubTab === 'exp-b') {
        this.runRegressionExperiment();
        this.render();
      }
    });

    this.runRegressionExperiment();
    this.runInterpolationExperiment();
    this.runRungeDemo();
    this.render();
  }

  destroy() {
    if (typeof this.unsubscribeState === 'function') {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }
    this.container.innerHTML = '';
  }

  runRegressionExperiment() {
    try {
      let x, y;
      if (this.regDatasetKey === 'cohort_transitions') {
        const accepted = stateManager.getState().acceptedDataset;
        const extracted = extractTransitionsForLab(accepted);
        if (extracted.count < 3) {
          this.regResult = { error: "Insufficient cohort transitions in accepted dataset (requires at least 3 consecutive transitions). Please import or stage a dataset." };
          return;
        }
        x = extracted.x;
        y = extracted.y;
      } else {
        const ds = REGRESSION_LAB_DATASETS[this.regDatasetKey] || REGRESSION_LAB_DATASETS.parabolic_dip_recovery;
        x = ds.x;
        y = ds.y;
      }

      this.regResult = fitLinearAndQuadraticRegression(x, y);
    } catch (err) {
      this.regResult = { error: err.message };
    }
  }

  runInterpolationExperiment() {
    try {
      this.interpResult = runNewtonInterpolationExperiment(this.interpX, this.interpY, this.interpXEval);
    } catch (err) {
      this.interpResult = { error: err.message };
    }
  }

  runRungeDemo() {
    try {
      this.rungeResult = runRungeExperiment(this.rungeNodes, this.rungeDist);
    } catch (err) {
      this.rungeResult = { error: err.message };
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="cp-page-stack">
        <header class="cp-page-heading">
          <span class="cp-kicker">CSE Numerical Methods Project · Phase 9</span>
          <h1>Numerical Methods Educational Laboratory</h1>
          <p>Interactive algorithmic investigations, step-by-step matrix elimination traces, polynomial fitting, and stability proofs.</p>
        </header>

        <!-- Sub-Navigation Pill Tabs & Synchronized Dropdown in Toolbar -->
        <div class="cp-toolbar" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-sm);">
          <div class="cp-filter-group" role="tablist" aria-label="Laboratory experiments">
            <button class="cp-chip ${this.activeSubTab === 'exp-a' ? 'is-active active' : ''} pill-btn" data-subtab="exp-a" role="tab" aria-selected="${this.activeSubTab === 'exp-a'}">
              A · Gaussian Elimination Trace
            </button>
            <button class="cp-chip ${this.activeSubTab === 'exp-b' ? 'is-active active' : ''} pill-btn" data-subtab="exp-b" role="tab" aria-selected="${this.activeSubTab === 'exp-b'}">
              B · Linear vs. Quadratic Regression
            </button>
            <button class="cp-chip ${this.activeSubTab === 'exp-c' ? 'is-active active' : ''} pill-btn" data-subtab="exp-c" role="tab" aria-selected="${this.activeSubTab === 'exp-c'}">
              C · Newton Divided Differences
            </button>
            <button class="cp-chip ${this.activeSubTab === 'exp-d' ? 'is-active active' : ''} pill-btn" data-subtab="exp-d" role="tab" aria-selected="${this.activeSubTab === 'exp-d'}">
              D · Runge Phenomenon & Risk
            </button>
            <button class="cp-chip ${this.activeSubTab === 'topics' ? 'is-active active' : ''} pill-btn" data-subtab="topics" role="tab" aria-selected="${this.activeSubTab === 'topics'}">
              E · Numerical Stability Topics
            </button>
          </div>
          <div class="cp-lab-dropdown-sync" style="display: inline-flex; align-items: center; gap: 6px;">
            <label for="lab-experiment-select" style="font-size: 12px; color: var(--cp-text-muted);">Experiment:</label>
            <select id="lab-experiment-select" class="cp-select cp-select-sm btn btn-secondary btn-sm" aria-label="Select laboratory experiment">
              <option value="exp-a" ${this.activeSubTab === 'exp-a' ? 'selected' : ''}>A · Gaussian Elimination Trace</option>
              <option value="exp-b" ${this.activeSubTab === 'exp-b' ? 'selected' : ''}>B · Linear vs. Quadratic Regression</option>
              <option value="exp-c" ${this.activeSubTab === 'exp-c' ? 'selected' : ''}>C · Newton Divided Differences</option>
              <option value="exp-d" ${this.activeSubTab === 'exp-d' ? 'selected' : ''}>D · Runge Phenomenon & Risk</option>
              <option value="topics" ${this.activeSubTab === 'topics' ? 'selected' : ''}>E · Numerical Stability Topics</option>
            </select>
          </div>
        </div>

        <div id="lab-subtab-content">
          ${this.renderActiveSubTabContent()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderActiveSubTabContent() {
    switch (this.activeSubTab) {
      case 'exp-a': return this.renderExperimentA();
      case 'exp-b': return this.renderExperimentB();
      case 'exp-c': return this.renderExperimentC();
      case 'exp-d': return this.renderExperimentD();
      case 'topics': return this.renderStabilityTopics();
      default: return this.renderExperimentA();
    }
  }

  /* --------------------------------------------------------------------------
     EXPERIMENT A: Gaussian Elimination Trace
     -------------------------------------------------------------------------- */
  renderExperimentA() {
    const res = this.gaussResult;
    const step = res.success && res.steps ? res.steps[this.gaussStepIndex] : null;
    const totalSteps = res.success && res.steps ? res.steps.length : 0;

    let matrixHtml = '';
    if (res.success && step && step.matrix) {
      const M = step.matrix;
      const rhs = step.rhs;
      const n = M.length;

      matrixHtml = `
        <div class="matrix-augmented-container cp-table-scroll" style="overflow-x: auto; margin: var(--space-md) 0;">
          <table class="table matrix-table cp-table" style="width: auto; margin: 0 auto; border-collapse: separate; border-spacing: 4px;">
            <thead>
              <tr>
                ${Array.from({ length: n }, (_, j) => `<th style="text-align: center; color: var(--cp-text-muted); font-size: 11px;">Col ${j + 1}</th>`).join('')}
                <th style="text-align: center; color: var(--cp-accent); font-size: 11px; border-left: 2px dashed var(--cp-line-strong); padding-left: 12px;">RHS (b)</th>
              </tr>
            </thead>
            <tbody>
              ${M.map((row, i) => `
                <tr class="${(step.stage === 'row_swap' && (i === step.row1 || i === step.row2)) ? 'matrix-row-swap' : ''}">
                  ${row.map((val, j) => {
                    let cellClass = 'matrix-cell';
                    if (step.stage === 'pivot_selection' && i === step.pivotRow && j === step.pivotCol) {
                      cellClass += ' matrix-cell-pivot';
                    } else if (step.stage === 'elimination_row' && i === step.targetRow && j === step.pivotRow) {
                      cellClass += ' matrix-cell-eliminated';
                    } else if (j < i && Math.abs(val) < 1e-12) {
                      cellClass += ' matrix-cell-zero';
                    }
                    return `<td class="${cellClass}" style="text-align: right; padding: 6px 12px; font-family: var(--font-mono); font-size: 13px;">${val.toFixed(4)}</td>`;
                  }).join('')}
                  <td style="text-align: right; padding: 6px 12px; font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: var(--cp-accent); border-left: 2px dashed var(--cp-line-strong); padding-left: 12px;">
                    ${rhs[i].toFixed(4)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      <article class="cp-panel cp-lab-stage chart-card">
        <header class="cp-panel-header chart-header">
          <div>
            <span class="cp-kicker">Experiment A</span>
            <h2 style="font-size: 16px; font-weight: 600; color: var(--cp-text); margin: 0;">
              Gaussian Elimination with Row Partial Pivoting
            </h2>
            <p style="font-size: 12px; color: var(--cp-text-muted); margin: 2px 0 0 0;">
              Step-by-step matrix reduction, scale-aware pivot selection, row multipliers, and back substitution.
            </p>
          </div>
          <div style="display: flex; gap: var(--space-xs); align-items: center; flex-wrap: wrap;">
            <label for="gauss-example-select" style="font-size: 12px; color: var(--cp-text-muted);">Preset:</label>
            <select id="gauss-example-select" class="cp-select cp-select-sm btn btn-secondary btn-sm">
              ${Object.values(GAUSSIAN_EXAMPLES).map(ex => `
                <option value="${ex.id}" ${this.gaussExampleKey === ex.id ? 'selected' : ''}>${ex.name}</option>
              `).join('')}
            </select>
            <button class="cp-button cp-button-ghost cp-button-sm btn btn-secondary btn-sm" id="btn-gauss-reset">Reset</button>
          </div>
        </header>

        ${!res.success ? `
          <div class="cp-alert cp-alert-danger alert alert-error" style="margin: var(--space-md) 0;">
            <strong>Singular System Rejection:</strong> ${res.error}
            <p style="margin: 4px 0 0 0; font-size: 12px;">
              The scale-aware pivot condition |a_pk| ≥ τ · s_scale was violated. Zero or near-zero pivot detected. The solver safely rejected the system without inventing numbers.
            </p>
          </div>
        ` : `
          <!-- Step Controls -->
          <div class="cp-step-controls" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 10px 16px; border-radius: var(--cp-radius-md); border: 1px solid var(--cp-line); margin-bottom: 16px;">
            <div style="display: flex; gap: 6px;">
              <button class="cp-button cp-button-secondary cp-button-sm btn btn-secondary btn-sm" id="btn-gauss-first" ${this.gaussStepIndex === 0 ? 'disabled' : ''}>|◀ First</button>
              <button class="cp-button cp-button-secondary cp-button-sm btn btn-secondary btn-sm" id="btn-gauss-prev" ${this.gaussStepIndex === 0 ? 'disabled' : ''}>◀ Prev</button>
              <button class="cp-button cp-button-primary cp-button-sm btn btn-secondary btn-sm" id="btn-gauss-next" data-step="next" ${this.gaussStepIndex >= totalSteps - 1 ? 'disabled' : ''}>Next ▶</button>
              <button class="cp-button cp-button-secondary cp-button-sm btn btn-secondary btn-sm" id="btn-gauss-last" ${this.gaussStepIndex >= totalSteps - 1 ? 'disabled' : ''}>Last ▶|</button>
            </div>
            <span class="cp-badge cp-badge-info" style="font-weight: 600;">
              Step ${this.gaussStepIndex + 1} of ${totalSteps}
            </span>
          </div>

          <!-- Step Description Card -->
          <div class="cp-formula" style="margin-bottom: 16px;">
            <div>
              <strong style="font-size: 13px; font-weight: 600; color: var(--cp-accent); display: block; margin-bottom: 2px;">
                ${step ? step.title : ''}
              </strong>
              <div style="font-size: 12px; color: var(--cp-text-muted); line-height: 1.4;">
                ${step ? step.description : ''}
              </div>
            </div>
          </div>

          <!-- Augmented Matrix State -->
          ${matrixHtml}

          <!-- Final Solution & Residual Vector -->
          ${res.solution ? `
            <div class="cp-result-comparison" style="margin-top: 16px;">
              <div>
                <span style="font-size: 11px; text-transform: uppercase; color: var(--cp-text-muted); margin-bottom: 4px;">Computed Solution Vector (x)</span>
                <div style="font-family: var(--font-mono); font-size: 13px; color: var(--cp-accent); font-weight: 600;">
                  [ ${res.solution.map((v, i) => `x_${i + 1} = ${v.toFixed(6)}`).join(', ')} ]
                </div>
              </div>
              <div>
                <span style="font-size: 11px; text-transform: uppercase; color: var(--cp-text-muted); margin-bottom: 4px;">Euclidean Residual Norm ||b - Ax||₂</span>
                <div style="font-family: var(--font-mono); font-size: 13px; color: var(--cp-warning); font-weight: 600;">
                  ${res.residualNorm.toExponential(4)} (r = [${res.residual.map(v => v.toExponential(2)).join(', ')}])
                </div>
              </div>
            </div>
          ` : ''}
        `}
      </article>
    `;
  }

  /* --------------------------------------------------------------------------
     EXPERIMENT B: Linear vs. Quadratic Regression
     -------------------------------------------------------------------------- */
  renderExperimentB() {
    const res = this.regResult;

    if (!res || res.error) {
      return `
        <article class="cp-panel chart-card">
          <div class="cp-alert cp-alert-danger alert alert-error">
            ${res ? res.error : "Unable to fit comparative regression models."}
          </div>
        </article>
      `;
    }

    const { observations, linearModel, quadraticModel, normalEquations, rssImprovementPercent, academicWarning } = res;

    // Build SVG curve comparing Linear vs Quadratic
    const svgWidth = 540;
    const svgHeight = 280;
    const padLeft = 45, padRight = 20, padTop = 20, padBottom = 35;
    const plotW = svgWidth - padLeft - padRight;
    const plotH = svgHeight - padTop - padBottom;

    const xVals = observations.map(o => o.x);
    const yVals = observations.map(o => o.y);
    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const minY = Math.min(...yVals, linearModel.predict(minX), quadraticModel.predict(minX));
    const maxY = Math.max(...yVals, linearModel.predict(maxX), quadraticModel.predict(maxX));

    const spanX = maxX - minX || 1.0;
    const spanY = maxY - minY || 1.0;

    const scaleX = (x) => padLeft + ((x - minX) / spanX) * plotW;
    const scaleY = (y) => padTop + plotH - ((y - minY) / spanY) * plotH;

    // Linear curve path
    const linP1 = `${scaleX(minX)},${scaleY(linearModel.predict(minX))}`;
    const linP2 = `${scaleX(maxX)},${scaleY(linearModel.predict(maxX))}`;
    const linPath = `M ${linP1} L ${linP2}`;

    // Quadratic curve path
    const quadSteps = 50;
    const quadPoints = [];
    for (let i = 0; i <= quadSteps; i++) {
      const xi = minX + (i / quadSteps) * spanX;
      const yi = quadraticModel.predict(xi);
      quadPoints.push(`${i === 0 ? 'M' : 'L'} ${scaleX(xi).toFixed(1)},${scaleY(yi).toFixed(1)}`);
    }
    const quadPath = quadPoints.join(' ');

    return `
      <article class="cp-panel chart-card">
        <header class="cp-panel-header chart-header">
          <div>
            <span class="cp-kicker">Experiment B</span>
            <h2 style="font-size: 16px; font-weight: 600; color: var(--cp-text); margin: 0;">
              Linear vs. Quadratic Least-Squares Regression
            </h2>
            <p style="font-size: 12px; color: var(--cp-text-muted); margin: 2px 0 0 0;">
              Demonstrates polynomial flexibility, centered normal equations, condition squaring, and overfitting risk.
            </p>
          </div>
          <div style="display: flex; gap: var(--space-xs); align-items: center; flex-wrap: wrap;">
            <label for="reg-dataset-select" style="font-size: 12px; color: var(--cp-text-muted);">Dataset:</label>
            <select id="reg-dataset-select" class="cp-select cp-select-sm btn btn-secondary btn-sm">
              ${Object.values(REGRESSION_LAB_DATASETS).map(ds => `
                <option value="${ds.id}" ${this.regDatasetKey === ds.id ? 'selected' : ''}>${ds.name}</option>
              `).join('')}
              <option value="cohort_transitions" ${this.regDatasetKey === 'cohort_transitions' ? 'selected' : ''}>Current Cohort Transitions (Phase 3)</option>
            </select>
            <button class="cp-button cp-button-ghost cp-button-sm btn btn-secondary btn-sm" id="btn-toggle-reg-view">
              ${this.regTableView ? 'Show Chart' : 'Show Data Table'}
            </button>
          </div>
        </header>

        ${this.regTableView ? `
          <div class="cp-table-scroll table-responsive" style="margin: var(--space-md) 0;">
            <table class="table cp-table" style="font-size: 12px;">
              <thead>
                <tr>
                  <th>Index</th>
                  <th>Predictor (x)</th>
                  <th>Observed (y)</th>
                  <th>Linear Fitted</th>
                  <th>Linear Residual (e_lin)</th>
                  <th>Quadratic Fitted</th>
                  <th>Quadratic Residual (e_quad)</th>
                </tr>
              </thead>
              <tbody>
                ${res.residualComparison.map(r => `
                  <tr>
                    <td>${r.index + 1}</td>
                    <td>${r.x.toFixed(4)}</td>
                    <td>${r.y.toFixed(4)}</td>
                    <td style="color: var(--cp-accent); font-weight: 600;">${r.linearFitted.toFixed(4)}</td>
                    <td>${r.linearResidual >= 0 ? '+' : ''}${r.linearResidual.toFixed(4)}</td>
                    <td style="color: var(--cp-info); font-weight: 600;">${r.quadraticFitted.toFixed(4)}</td>
                    <td>${r.quadraticResidual >= 0 ? '+' : ''}${r.quadraticResidual.toFixed(4)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="svg-chart-container cp-table-scroll" style="margin: var(--space-md) 0;">
            <svg class="chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" style="max-width: 100%; height: auto;" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Linear vs Quadratic Regression Plot">
              <!-- Gridlines -->
              <line x1="${padLeft}" y1="${padTop}" x2="${padLeft + plotW}" y2="${padTop}" stroke="var(--cp-line)" stroke-width="1" stroke-dasharray="2,2"/>
              <line x1="${padLeft}" y1="${padTop + plotH / 2}" x2="${padLeft + plotW}" y2="${padTop + plotH / 2}" stroke="var(--cp-line)" stroke-width="1" stroke-dasharray="2,2"/>
              <line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="var(--cp-line)" stroke-width="1"/>

              <!-- Linear Fit Line -->
              <path d="${linPath}" fill="none" stroke="var(--cp-accent)" stroke-width="2.5" />

              <!-- Quadratic Fit Curve -->
              <path d="${quadPath}" fill="none" stroke="var(--cp-info)" stroke-width="2.5" stroke-dasharray="5,3" />

              <!-- Observations -->
              ${observations.map(o => `
                <circle cx="${scaleX(o.x).toFixed(1)}" cy="${scaleY(o.y).toFixed(1)}" r="4" fill="var(--cp-warning)" stroke="#0a0a0c" stroke-width="1.5" />
              `).join('')}

              <!-- Axis Labels -->
              <text x="${padLeft + plotW / 2}" y="${svgHeight - 8}" text-anchor="middle" font-size="11" fill="var(--cp-text-muted)">Predictor (x)</text>
              <text x="12" y="${padTop + plotH / 2}" text-anchor="middle" font-size="11" fill="var(--cp-text-muted)" transform="rotate(-90 12 ${padTop + plotH / 2})">Response (y)</text>
            </svg>
          </div>
        `}

        <!-- Legend and Model Metrics Cards -->
        <div class="chart-legend cp-chart-legend" style="display: flex; gap: var(--space-md); justify-content: center; margin-bottom: var(--space-md);">
          <span style="font-size: 12px; color: var(--cp-text-muted); display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--cp-warning);"></span> Observations (n = ${observations.length})
          </span>
          <span style="font-size: 12px; color: var(--cp-text-muted); display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 16px; height: 3px; background: var(--cp-accent);"></span> Linear Model (Degree 1)
          </span>
          <span style="font-size: 12px; color: var(--cp-text-muted); display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 16px; height: 3px; background: var(--cp-info);"></span> Quadratic Model (Degree 2)
          </span>
        </div>

        <div class="cp-result-comparison" style="margin-bottom: var(--space-md);">
          <!-- Linear Model Card -->
          <div style="background: rgba(255, 48, 56, 0.05); border: 1px solid rgba(255, 48, 56, 0.2); border-radius: var(--cp-radius-sm); padding: var(--space-sm) var(--space-md);">
            <div style="font-size: 12px; font-weight: 600; color: var(--cp-accent); margin-bottom: 4px;">Model 1: First-Order Linear</div>
            <div style="font-family: var(--font-mono); font-size: 13px; color: var(--cp-text); margin-bottom: 6px;">${linearModel.formula}</div>
            <div style="font-size: 12px; color: var(--cp-text-muted);">
              Residual Sum of Squares (RSS): <strong style="color: var(--cp-text);">${linearModel.rss.toFixed(4)}</strong><br>
              Mean Squared Error (MSE): ${linearModel.mse.toFixed(4)}
            </div>
          </div>

          <!-- Quadratic Model Card -->
          <div style="background: rgba(6, 182, 212, 0.05); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: var(--cp-radius-sm); padding: var(--space-sm) var(--space-md);">
            <div style="font-size: 12px; font-weight: 600; color: var(--cp-info); margin-bottom: 4px;">Model 2: Second-Order Quadratic</div>
            <div style="font-family: var(--font-mono); font-size: 13px; color: var(--cp-text); margin-bottom: 6px;">${quadraticModel.formula}</div>
            <div style="font-size: 12px; color: var(--cp-text-muted);">
              Residual Sum of Squares (RSS): <strong style="color: var(--cp-text);">${quadraticModel.rss.toFixed(4)}</strong> (${rssImprovementPercent.toFixed(1)}% reduction)<br>
              Mean Squared Error (MSE): ${quadraticModel.mse.toFixed(4)}
            </div>
          </div>
        </div>

        <!-- Academic Overfitting Warning -->
        <div class="cp-alert cp-alert-warning alert alert-warning" style="font-size: 12px; line-height: 1.4;">
          <strong>Educational Takeaway:</strong> ${academicWarning}
        </div>
      </article>
    `;
  }

  /* --------------------------------------------------------------------------
     EXPERIMENT C: Newton Divided Differences
     -------------------------------------------------------------------------- */
  renderExperimentC() {
    const res = this.interpResult;

    if (!res || res.error) {
      return `
        <article class="cp-panel chart-card">
          <div class="cp-alert cp-alert-danger alert alert-error">
            ${res ? res.error : "Unable to construct Newton interpolating polynomial."}
          </div>
        </article>
      `;
    }

    const { nodes, coefficients, table, xEval, evaluatedValue, terms, isExtrapolation, extrapolationDistance, curvePoints, academicNotice } = res;

    // SVG Interpolation Curve
    const svgWidth = 540;
    const svgHeight = 260;
    const padLeft = 45, padRight = 20, padTop = 20, padBottom = 35;
    const plotW = svgWidth - padLeft - padRight;
    const plotH = svgHeight - padTop - padBottom;

    const allX = curvePoints.map(p => p.x);
    const allY = curvePoints.map(p => p.y);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY, evaluatedValue);
    const maxY = Math.max(...allY, evaluatedValue);

    const spanX = maxX - minX || 1.0;
    const spanY = maxY - minY || 1.0;

    const scaleX = (x) => padLeft + ((x - minX) / spanX) * plotW;
    const scaleY = (y) => padTop + plotH - ((y - minY) / spanY) * plotH;

    const pathData = curvePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(1)},${scaleY(p.y).toFixed(1)}`).join(' ');

    return `
      <article class="cp-panel chart-card">
        <header class="cp-panel-header chart-header">
          <div>
            <span class="cp-kicker">Experiment C</span>
            <h2 style="font-size: 16px; font-weight: 600; color: var(--cp-text); margin: 0;">
              Newton Divided-Difference Polynomial Interpolation
            </h2>
            <p style="font-size: 12px; color: var(--cp-text-muted); margin: 2px 0 0 0;">
              Triangular divided-difference recurrence, term-by-term evaluation, and interpolation hull boundaries.
            </p>
          </div>
          <div style="display: flex; gap: var(--space-xs); align-items: center; flex-wrap: wrap;">
            <label for="interp-example-select" style="font-size: 12px; color: var(--cp-text-muted);">Preset:</label>
            <select id="interp-example-select" class="cp-select cp-select-sm btn btn-secondary btn-sm">
              ${Object.values(INTERPOLATION_EXAMPLES).map(ex => `
                <option value="${ex.id}" ${this.interpExampleKey === ex.id ? 'selected' : ''}>${ex.name}</option>
              `).join('')}
            </select>
            <button class="cp-button cp-button-ghost cp-button-sm btn btn-secondary btn-sm" id="btn-toggle-interp-view">
              ${this.interpTableView ? 'Show Chart' : 'Show Terms Table'}
            </button>
          </div>
        </header>

        <!-- Evaluation Coordinate Input -->
        <div class="cp-toolbar" style="margin-bottom: var(--space-md); flex-wrap: wrap;">
          <label for="input-interp-eval" style="font-size: 12px; color: var(--cp-text-muted); font-weight: 500;">Query Coordinate (x):</label>
          <input type="number" step="0.1" id="input-interp-eval" class="cp-input input input-sm" style="width: 100px;" value="${xEval}">
          <button class="cp-button cp-button-secondary cp-button-sm btn btn-secondary btn-sm" id="btn-interp-eval">Evaluate P(x)</button>
          <span style="font-size: 12px; color: var(--cp-text-muted); margin-left: auto;">
            Observed Node Domain: [${res.domain.min.toFixed(2)}, ${res.domain.max.toFixed(2)}]
          </span>
        </div>

        <!-- Divided-Difference Triangular Table -->
        <div style="margin-bottom: var(--space-md);">
          <div style="font-size: 12px; font-weight: 600; color: var(--cp-text-muted); margin-bottom: 6px;">Divided-Difference Recurrence Table:</div>
          <div class="cp-table-scroll table-responsive">
            <table class="table cp-table" style="font-size: 12px; font-family: var(--font-mono);">
              <thead>
                <tr>
                  <th>x_i</th>
                  <th>f[x_i] (c0)</th>
                  ${Array.from({ length: nodes.length - 1 }, (_, j) => `<th>Order ${j + 1} ${j === 0 ? '(c1)' : j === 1 ? '(c2)' : ''}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${nodes.map((node, i) => `
                  <tr>
                    <td style="font-weight: 600; color: var(--cp-warning);">${node.x.toFixed(2)}</td>
                    ${table[i].slice(0, nodes.length - i).map((val, j) => `
                      <td style="${i === 0 ? 'color: var(--cp-accent); font-weight: 600;' : ''}">${val.toFixed(4)}</td>
                    `).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${this.interpTableView ? `
          <!-- Term-by-Term Polynomial Breakdown Table -->
          <div class="cp-table-scroll table-responsive" style="margin-bottom: var(--space-md);">
            <table class="table cp-table" style="font-size: 12px;">
              <thead>
                <tr>
                  <th>Order (k)</th>
                  <th>Coefficient (c_k)</th>
                  <th>Basis Term Π(x - x_j)</th>
                  <th>Evaluated Basis at x = ${xEval}</th>
                  <th>Term Value (c_k · Π)</th>
                  <th>Running Sum P_k(x)</th>
                </tr>
              </thead>
              <tbody>
                ${terms.map(t => `
                  <tr>
                    <td>${t.order}</td>
                    <td style="font-family: var(--font-mono); color: var(--cp-accent);">${t.coefficient.toFixed(4)}</td>
                    <td style="font-family: var(--font-mono);">${t.basisFormula}</td>
                    <td style="font-family: var(--font-mono);">${t.basisValueAtEval.toFixed(4)}</td>
                    <td style="font-family: var(--font-mono); font-weight: 600;">${t.termValue.toFixed(4)}</td>
                    <td style="font-family: var(--font-mono); color: var(--cp-warning); font-weight: 600;">${t.runningSum.toFixed(4)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <!-- SVG Interpolation Curve -->
          <div class="svg-chart-container cp-table-scroll" style="margin-bottom: var(--space-md);">
            <svg class="chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" style="max-width: 100%; height: auto;" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Newton Interpolating Polynomial">
              <!-- Interpolation Domain Hull Guide -->
              <rect x="${scaleX(res.domain.min)}" y="${padTop}" width="${scaleX(res.domain.max) - scaleX(res.domain.min)}" height="${plotH}" fill="rgba(255,255,255,0.02)" stroke="var(--cp-line)" stroke-dasharray="2,2" />

              <!-- Interpolating Polynomial Path -->
              <path d="${pathData}" fill="none" stroke="var(--cp-accent)" stroke-width="2.5" />

              <!-- Data Nodes -->
              ${nodes.map(n => `
                <circle cx="${scaleX(n.x).toFixed(1)}" cy="${scaleY(n.y).toFixed(1)}" r="4.5" fill="var(--cp-warning)" stroke="#0a0a0c" stroke-width="1.5" />
              `).join('')}

              <!-- Evaluation Query Point -->
              <line x1="${scaleX(xEval).toFixed(1)}" y1="${padTop + plotH}" x2="${scaleX(xEval).toFixed(1)}" y2="${scaleY(evaluatedValue).toFixed(1)}" stroke="var(--cp-info)" stroke-width="1.5" stroke-dasharray="3,3" />
              <circle cx="${scaleX(xEval).toFixed(1)}" cy="${scaleY(evaluatedValue).toFixed(1)}" r="5.5" fill="var(--cp-info)" stroke="#0a0a0c" stroke-width="1.5" />

              <!-- Axis Labels -->
              <text x="${padLeft + plotW / 2}" y="${svgHeight - 8}" text-anchor="middle" font-size="11" fill="var(--cp-text-muted)">Evaluation Coordinate (x)</text>
              <text x="12" y="${padTop + plotH / 2}" text-anchor="middle" font-size="11" fill="var(--cp-text-muted)" transform="rotate(-90 12 ${padTop + plotH / 2})">P(x)</text>
            </svg>
          </div>
        `}

        <!-- Result Callout & Extrapolation Warning -->
        <div class="cp-result-comparison" style="margin-bottom: var(--space-sm);">
          <div>
            <span style="font-size: 12px; color: var(--cp-text-muted);">Evaluated Polynomial Result:</span>
            <div style="font-family: var(--font-mono); font-size: 15px; font-weight: 700; color: var(--cp-info); margin-top: 4px;">
              P_${nodes.length - 1}(${xEval}) = ${evaluatedValue.toFixed(4)}
            </div>
          </div>
          <div style="display: flex; align-items: center; justify-content: flex-end;">
            <span class="cp-badge badge ${isExtrapolation ? 'cp-badge-warning badge-amber' : 'cp-badge-success badge-emerald'}">
              ${isExtrapolation ? `EXTRAPOLATION (Δ = +${extrapolationDistance.toFixed(2)})` : 'INTERIOR INTERPOLATION'}
            </span>
          </div>
        </div>

        <div class="cp-alert alert ${isExtrapolation ? 'cp-alert-warning alert-warning' : 'cp-alert-info alert-info'}" style="font-size: 12px; line-height: 1.4;">
          ${academicNotice}
        </div>
      </article>
    `;
  }

  /* --------------------------------------------------------------------------
     EXPERIMENT D: Runge Phenomenon & Risk
     -------------------------------------------------------------------------- */
  renderExperimentD() {
    const res = this.rungeResult;

    if (!res || res.error) {
      return `
        <article class="cp-panel chart-card">
          <div class="cp-alert cp-alert-danger alert alert-error">
            ${res ? res.error : "Unable to simulate Runge phenomenon."}
          </div>
        </article>
      `;
    }

    const { nodes, grid, errorMetrics, academicTakeaway, degree, distributionType } = res;

    // SVG Plot: True Function vs Polynomial
    const svgWidth = 540;
    const svgHeight = 280;
    const padLeft = 45, padRight = 20, padTop = 20, padBottom = 35;
    const plotW = svgWidth - padLeft - padRight;
    const plotH = svgHeight - padTop - padBottom;

    // Fixed display range for Runge function on [-1, 1]
    const minX = -1.0, maxX = 1.0;
    const minY = -0.2, maxY = 1.2;

    const scaleX = (x) => padLeft + ((x - minX) / (maxX - minX)) * plotW;
    const scaleY = (y) => {
      const clampedY = Math.max(-0.5, Math.min(1.5, y));
      return padTop + plotH - ((clampedY - minY) / (maxY - minY)) * plotH;
    };

    // True function path
    const truePath = grid.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(pt.x).toFixed(1)},${scaleY(pt.fTrue).toFixed(1)}`).join(' ');

    // Polynomial path
    const polyPath = grid.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(pt.x).toFixed(1)},${scaleY(pt.fPoly).toFixed(1)}`).join(' ');

    return `
      <article class="cp-panel chart-card">
        <header class="cp-panel-header chart-header">
          <div>
            <span class="cp-kicker">Experiment D</span>
            <h2 style="font-size: 16px; font-weight: 600; color: var(--cp-text); margin: 0;">
              Runge Phenomenon & Extrapolation Risk
            </h2>
            <p style="font-size: 12px; color: var(--cp-text-muted); margin: 2px 0 0 0;">
              Deterministic synthetic test function f(x) = 1 / (1 + 25x²) illustrating catastrophic edge oscillation.
            </p>
          </div>
          <span class="cp-badge cp-badge-info badge badge-synthetic">SYNTHETIC EXPERIMENT</span>
        </header>

        <!-- Controls: Node count and Distribution -->
        <div class="cp-toolbar" style="margin-bottom: var(--space-md); flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <label for="select-runge-nodes" style="font-size: 12px; color: var(--cp-text-muted); font-weight: 500;">Node Count (N):</label>
            <select id="select-runge-nodes" class="cp-select cp-select-sm btn btn-secondary btn-sm">
              ${[5, 7, 9, 11, 13].map(n => `
                <option value="${n}" ${this.rungeNodes === n ? 'selected' : ''}>N = ${n} (Degree ${n - 1})</option>
              `).join('')}
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: var(--space-sm); margin-left: auto;">
            <span style="font-size: 12px; color: var(--cp-text-muted); font-weight: 500;">Node Distribution:</span>
            <label style="font-size: 12px; color: var(--cp-text); display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="radio" name="runge-dist" value="equally_spaced" ${distributionType === 'equally_spaced' ? 'checked' : ''}> Equally Spaced
            </label>
            <label style="font-size: 12px; color: var(--cp-text); display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="radio" name="runge-dist" value="chebyshev" ${distributionType === 'chebyshev' ? 'checked' : ''}> Chebyshev Density
            </label>
          </div>
        </div>

        <!-- SVG Plot -->
        <div class="svg-chart-container cp-table-scroll" style="margin-bottom: var(--space-md);">
          <svg class="chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" style="max-width: 100%; height: auto;" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Runge Phenomenon Oscillation Plot">
            <!-- Zero reference line -->
            <line x1="${padLeft}" y1="${scaleY(0)}" x2="${padLeft + plotW}" y2="${scaleY(0)}" stroke="var(--cp-line)" stroke-width="1"/>

            <!-- True Function f(x) (Cyan) -->
            <path d="${truePath}" fill="none" stroke="var(--cp-info)" stroke-width="2" stroke-dasharray="4,3" />

            <!-- Interpolating Polynomial P_n(x) (Crimson) -->
            <path d="${polyPath}" fill="none" stroke="var(--cp-accent)" stroke-width="2.5" />

            <!-- Interpolation Nodes -->
            ${nodes.map(n => `
              <circle cx="${scaleX(n.x).toFixed(1)}" cy="${scaleY(n.y).toFixed(1)}" r="4" fill="var(--cp-warning)" stroke="#0a0a0c" stroke-width="1.5" />
            `).join('')}

            <!-- Axis Labels -->
            <text x="${padLeft + plotW / 2}" y="${svgHeight - 8}" text-anchor="middle" font-size="11" fill="var(--cp-text-muted)">Interval x ∈ [-1.0, +1.0]</text>
            <text x="12" y="${padTop + plotH / 2}" text-anchor="middle" font-size="11" fill="var(--cp-text-muted)" transform="rotate(-90 12 ${padTop + plotH / 2})">f(x), P_n(x)</text>
          </svg>
        </div>

        <!-- Legend and Metrics -->
        <div class="chart-legend cp-chart-legend" style="display: flex; gap: var(--space-md); justify-content: center; margin-bottom: var(--space-md);">
          <span style="font-size: 12px; color: var(--cp-text-muted); display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 16px; height: 2px; border-top: 2px dashed var(--cp-info);"></span> True Function f(x)
          </span>
          <span style="font-size: 12px; color: var(--cp-text-muted); display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 16px; height: 3px; background: var(--cp-accent);"></span> Interpolating Polynomial (Degree ${degree})
          </span>
          <span style="font-size: 12px; color: var(--cp-text-muted); display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--cp-warning);"></span> Exact Nodes (${nodes.length})
          </span>
        </div>

        <div class="cp-result-comparison" style="margin-bottom: var(--space-md);">
          <div>
            <span style="font-size: 11px; text-transform: uppercase; color: var(--cp-text-muted); margin-bottom: 4px;">Maximum Interpolation Error (Interior)</span>
            <div style="font-family: var(--font-mono); font-size: 15px; font-weight: 700; color: var(--cp-accent);">
              ${errorMetrics.maxAbsError.toFixed(4)} <span style="font-size: 11px; font-weight: 400; color: var(--cp-text-muted);">(at x = ${errorMetrics.maxErrorLocation.toFixed(2)})</span>
            </div>
            <div style="font-size: 11px; color: var(--cp-text-muted); margin-top: 2px;">Root Mean Squared Error (RMSE): ${errorMetrics.rmse.toFixed(4)}</div>
          </div>

          <div>
            <span style="font-size: 11px; text-transform: uppercase; color: var(--cp-text-muted); margin-bottom: 4px;">Forward Extrapolation Sample (at x = +1.15)</span>
            <div style="font-family: var(--font-mono); font-size: 15px; font-weight: 700; color: var(--cp-warning);">
              Error = ${errorMetrics.extrapolationSample.error.toFixed(4)}
            </div>
            <div style="font-size: 11px; color: var(--cp-text-muted); margin-top: 2px;">f_true = ${errorMetrics.extrapolationSample.fTrue.toFixed(4)} vs P(1.15) = ${errorMetrics.extrapolationSample.fPoly.toFixed(4)}</div>
          </div>
        </div>

        <div class="cp-alert cp-alert-warning alert alert-warning" style="font-size: 12px; line-height: 1.4;">
          <strong>Educational Proof:</strong> ${academicTakeaway}
        </div>
      </article>
    `;
  }

  /* --------------------------------------------------------------------------
     STABILITY & CONDITIONING TOPICS
     -------------------------------------------------------------------------- */
  renderStabilityTopics() {
    return `
      <div class="cp-dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
        ${NUMERICAL_STABILITY_TOPICS.map(topic => `
          <article class="cp-panel chart-card" style="padding: var(--space-md);">
            <header class="cp-panel-header" style="margin-bottom: var(--space-sm);">
              <h3 style="font-size: 15px; font-weight: 600; color: var(--cp-text); margin: 0;">${topic.title}</h3>
              <span class="cp-badge cp-badge-danger badge badge-crimson" style="font-size: 10px;">${topic.badge}</span>
            </header>
            <div style="font-size: 12px; color: var(--cp-text-muted); line-height: 1.5;">
              ${topic.content.trim().split('\n\n').map(p => `<p style="margin: 0 0 8px 0;">${p.trim()}</p>`).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  /* --------------------------------------------------------------------------
     EVENT BINDINGS
     -------------------------------------------------------------------------- */
  bindEvents() {
    // Sub-tab switching
    const subTabButtons = this.container.querySelectorAll('.pill-btn[data-subtab]');
    subTabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.activeSubTab = btn.getAttribute('data-subtab');
        this.render();
      });
    });

    // Synchronized experiment select dropdown
    const labExperimentSelect = this.container.querySelector('#lab-experiment-select');
    if (labExperimentSelect) {
      labExperimentSelect.addEventListener('change', (e) => {
        this.activeSubTab = e.target.value;
        this.render();
      });
    }

    // Experiment A events
    const gaussSelect = this.container.querySelector('#gauss-example-select');
    if (gaussSelect) {
      gaussSelect.addEventListener('change', (e) => {
        this.gaussExampleKey = e.target.value;
        const ex = GAUSSIAN_EXAMPLES[this.gaussExampleKey];
        if (ex) {
          this.gaussA = ex.A.map(row => [...row]);
          this.gaussB = [...ex.b];
          this.gaussResult = runGaussianEliminationExperiment(this.gaussA, this.gaussB);
          this.gaussStepIndex = 0;
          this.render();
        }
      });
    }

    const btnGaussReset = this.container.querySelector('#btn-gauss-reset');
    if (btnGaussReset) {
      btnGaussReset.addEventListener('click', () => {
        const ex = GAUSSIAN_EXAMPLES[this.gaussExampleKey];
        if (ex) {
          this.gaussA = ex.A.map(row => [...row]);
          this.gaussB = [...ex.b];
          this.gaussResult = runGaussianEliminationExperiment(this.gaussA, this.gaussB);
          this.gaussStepIndex = 0;
          this.render();
        }
      });
    }

    const btnGaussFirst = this.container.querySelector('#btn-gauss-first');
    if (btnGaussFirst) {
      btnGaussFirst.addEventListener('click', () => {
        this.gaussStepIndex = 0;
        this.render();
      });
    }

    const btnGaussPrev = this.container.querySelector('#btn-gauss-prev');
    if (btnGaussPrev) {
      btnGaussPrev.addEventListener('click', () => {
        if (this.gaussStepIndex > 0) {
          this.gaussStepIndex--;
          this.render();
        }
      });
    }

    const btnGaussNext = this.container.querySelector('#btn-gauss-next');
    if (btnGaussNext) {
      btnGaussNext.addEventListener('click', () => {
        if (this.gaussResult.success && this.gaussStepIndex < this.gaussResult.steps.length - 1) {
          this.gaussStepIndex++;
          this.render();
        }
      });
    }

    const btnGaussLast = this.container.querySelector('#btn-gauss-last');
    if (btnGaussLast) {
      btnGaussLast.addEventListener('click', () => {
        if (this.gaussResult.success) {
          this.gaussStepIndex = this.gaussResult.steps.length - 1;
          this.render();
        }
      });
    }

    // Experiment B events
    const regSelect = this.container.querySelector('#reg-dataset-select');
    if (regSelect) {
      regSelect.addEventListener('change', (e) => {
        this.regDatasetKey = e.target.value;
        this.runRegressionExperiment();
        this.render();
      });
    }

    const btnToggleRegView = this.container.querySelector('#btn-toggle-reg-view');
    if (btnToggleRegView) {
      btnToggleRegView.addEventListener('click', () => {
        this.regTableView = !this.regTableView;
        this.render();
      });
    }

    // Experiment C events
    const interpSelect = this.container.querySelector('#interp-example-select');
    if (interpSelect) {
      interpSelect.addEventListener('change', (e) => {
        this.interpExampleKey = e.target.value;
        const ex = INTERPOLATION_EXAMPLES[this.interpExampleKey];
        if (ex) {
          this.interpX = [...ex.x];
          this.interpY = [...ex.y];
          this.interpXEval = ex.xEval;
          this.runInterpolationExperiment();
          this.render();
        }
      });
    }

    const btnToggleInterpView = this.container.querySelector('#btn-toggle-interp-view');
    if (btnToggleInterpView) {
      btnToggleInterpView.addEventListener('click', () => {
        this.interpTableView = !this.interpTableView;
        this.render();
      });
    }

    const btnInterpEval = this.container.querySelector('#btn-interp-eval');
    if (btnInterpEval) {
      btnInterpEval.addEventListener('click', () => {
        const inputVal = Number(this.container.querySelector('#input-interp-eval').value);
        if (Number.isFinite(inputVal)) {
          this.interpXEval = inputVal;
          this.runInterpolationExperiment();
          this.render();
        }
      });
    }

    // Experiment D events
    const rungeNodesSelect = this.container.querySelector('#select-runge-nodes');
    if (rungeNodesSelect) {
      rungeNodesSelect.addEventListener('change', (e) => {
        this.rungeNodes = Number(e.target.value);
        this.runRungeDemo();
        this.render();
      });
    }

    const rungeRadios = this.container.querySelectorAll('input[name="runge-dist"]');
    rungeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.rungeDist = e.target.value;
        this.runRungeDemo();
        this.render();
      });
    });
  }
}
