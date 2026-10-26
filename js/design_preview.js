export function getPreviewModel() {
  return {
    productName: 'Gradivue',
    isSynthetic: true,
    sections: [
      { id: 'overview', label: 'Overview', description: 'Academic analytics command center' },
      { id: 'dataset', label: 'Dataset Management', description: 'Import, validate, and review records' },
      { id: 'individual', label: 'Individual Prediction', description: 'Forecast a single student trajectory' },
      { id: 'class', label: 'Whole-Class Prediction', description: 'Compare cohort forecasts and baselines' },
      { id: 'ocr', label: 'OCR Review', description: 'Guided local document extraction' },
      { id: 'lab', label: 'Numerical Methods Lab', description: 'Explore algorithms step by step' }
    ]
  };
}

function activatePreviewSection(targetId) {
  document.querySelectorAll('[data-preview-section]').forEach(section => {
    section.hidden = section.dataset.previewSection !== targetId;
  });
  document.querySelectorAll('[data-preview-target]').forEach(control => {
    const active = control.dataset.previewTarget === targetId;
    control.classList.toggle('is-active', active);
    control.setAttribute('aria-current', active ? 'page' : 'false');
  });
  const model = getPreviewModel();
  const activeSection = model.sections.find(section => section.id === targetId);
  const title = document.querySelector('#preview-page-title');
  if (title && activeSection) title.textContent = activeSection.label;
  document.querySelector('#preview-sidebar')?.classList.remove('is-open');
  document.querySelector('#preview-backdrop')?.classList.remove('is-visible');
}

function initializePredictionDemo() {
  const form = document.querySelector('#preview-prediction-form');
  if (!form) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = [...form.querySelectorAll('[data-sgpa]')].map(input => Number(input.value));
    const first = values[0];
    const last = values[values.length - 1];
    const forecast = Math.max(0, Math.min(4, last + (last - first) / Math.max(1, values.length - 1)));
    document.querySelector('#preview-forecast-value').textContent = forecast.toFixed(2);
    document.querySelector('#preview-baseline-value').textContent = last.toFixed(2);
    document.querySelector('#preview-result-empty').hidden = true;
    document.querySelector('#preview-result-ready').hidden = false;
  });
}

function initializeClassFilter() {
  const input = document.querySelector('#preview-class-filter');
  if (!input) return;
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    document.querySelectorAll('#preview-class-table tbody tr').forEach(row => {
      row.hidden = !row.textContent.toLowerCase().includes(query);
    });
  });
}

function initializeOcrStepper() {
  let currentStep = 1;
  const render = () => {
    document.querySelectorAll('[data-ocr-step]').forEach(step => {
      const number = Number(step.dataset.ocrStep);
      step.classList.toggle('is-active', number === currentStep);
      step.classList.toggle('is-complete', number < currentStep);
    });
    const output = document.querySelector('#preview-ocr-step-label');
    const active = document.querySelector(`[data-ocr-step="${currentStep}"]`);
    if (output && active) output.textContent = active.dataset.stepLabel;
  };
  document.querySelectorAll('[data-ocr-direction]').forEach(button => {
    button.addEventListener('click', () => {
      currentStep = Math.max(1, Math.min(7, currentStep + Number(button.dataset.ocrDirection)));
      render();
    });
  });
  render();
}

export const EXPERIMENT_PREVIEWS = {
  gaussian: {
    id: 'gaussian',
    kicker: 'Experiment A',
    title: 'Partial-pivot Gaussian elimination',
    badge: 'Step 3 of 12',
    description: 'Trace row swaps, scale-aware pivots, elimination multipliers, and back substitution.',
    content: `
      <div class="cp-matrix" aria-label="Augmented matrix">
        <div><span>1.0000</span><span>2.0000</span><span>3.0000</span><b>14.0000</b></div>
        <div class="is-pivot"><span>2.0000</span><span>5.0000</span><span>2.0000</span><b>18.0000</b></div>
        <div><span>3.0000</span><span>1.0000</span><span>5.0000</span><b>20.0000</b></div>
      </div>
      <div class="cp-step-controls">
        <button class="cp-icon-button" aria-label="First step">|◀</button>
        <button class="cp-button cp-button-secondary">Previous</button>
        <button class="cp-button cp-button-primary">Next operation</button>
        <button class="cp-icon-button" aria-label="Last step">▶|</button>
      </div>
      <div class="cp-formula"><span>Row operation</span><code>R₃ ← R₃ − 1.5R₂</code></div>
    `
  },
  regression: {
    id: 'regression',
    kicker: 'Experiment B',
    title: 'Linear vs quadratic regression',
    badge: 'Least-squares fit',
    description: 'Compare linear and quadratic least-squares fits on the same synthetic observations.',
    content: `
      <div class="cp-result-comparison" style="margin-bottom: 16px;">
        <div>
          <span style="font-size: 11px; text-transform: uppercase; color: var(--cp-text-muted);">Linear Model</span>
          <div style="font-family: var(--font-mono); font-size: 13px; color: var(--cp-accent); font-weight: 600;">y = 0.8400x + 0.5200</div>
          <small style="color: var(--cp-text-muted);">RSS: 0.1420</small>
        </div>
        <div>
          <span style="font-size: 11px; text-transform: uppercase; color: var(--cp-text-muted);">Centered Quadratic Model</span>
          <div style="font-family: var(--font-mono); font-size: 13px; color: var(--cp-warning); font-weight: 600;">y = 0.4200x² - 1.1500x + 3.1200</div>
          <small style="color: var(--cp-text-muted);">RSS: 0.0480 (66.2% improvement)</small>
        </div>
      </div>
      <div class="cp-formula"><span>Condition Squaring Note</span><code>κ₂(XᵀX) ≈ [κ₂(X)]² • Centering predictor prevents ill-conditioning</code></div>
    `
  },
  newton: {
    id: 'newton',
    kicker: 'Experiment C',
    title: 'Newton divided differences',
    badge: 'Polynomial table',
    description: 'Inspect the divided-difference table and evaluate the Newton polynomial.',
    content: `
      <div class="cp-table-scroll" style="margin-bottom: 16px;">
        <table class="cp-table" style="width: 100%; font-size: 12px;">
          <thead>
            <tr><th>x_i</th><th>f[x_i]</th><th>f[x_i, x_{i+1}]</th><th>f[x_i, x_{i+1}, x_{i+2}]</th></tr>
          </thead>
          <tbody>
            <tr><td>0.00</td><td>1.0000</td><td>3.0000</td><td>1.0000</td></tr>
            <tr><td>1.00</td><td>4.0000</td><td>5.0000</td><td>—</td></tr>
            <tr><td>2.00</td><td>9.0000</td><td>—</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
      <div class="cp-formula"><span>Reconstructed Polynomial</span><code>P₂(x) = 1 + 3(x - 0) + 1(x - 0)(x - 1) = x² + 2x + 1</code></div>
    `
  },
  runge: {
    id: 'runge',
    kicker: 'Experiment D',
    title: 'Runge phenomenon & extrapolation risk',
    badge: 'High-degree oscillation',
    description: 'Compare equally spaced and Chebyshev nodes on the Runge function.',
    content: `
      <div class="cp-result-comparison" style="margin-bottom: 16px;">
        <div>
          <span style="font-size: 11px; text-transform: uppercase; color: var(--cp-text-muted);">Target Function</span>
          <div style="font-family: var(--font-mono); font-size: 13px; color: var(--cp-accent); font-weight: 600;">f(x) = 1 / (1 + 25x²)</div>
        </div>
        <div>
          <span style="font-size: 11px; text-transform: uppercase; color: var(--cp-text-muted);">Selected Nodes (n = 7)</span>
          <div style="font-family: var(--font-mono); font-size: 13px; color: var(--cp-warning); font-weight: 600;">Equally Spaced vs Chebyshev</div>
        </div>
      </div>
      <div class="cp-alert cp-alert-warning" style="margin-bottom: 16px;">
        <strong>Extrapolation Risk Warning:</strong> Equispaced polynomial interpolation oscillates wildly near interval boundaries |x| → 1 for high degree n. Chebyshev node distribution minimizes minimax interpolation error.
      </div>
      <div class="cp-formula"><span>Minimax Bound</span><code>x_k = cos(((2k - 1) / (2n)) * π) • Optimal node placement</code></div>
    `
  },
  stability: {
    id: 'stability',
    kicker: 'Experiment E',
    title: 'Numerical stability & conditioning',
    badge: 'Conditioning & proofs',
    description: 'Study residuals, conditioning, and floating-point error propagation.',
    content: `
      <div class="cp-result-comparison" style="margin-bottom: 16px;">
        <div>
          <span style="font-size: 11px; text-transform: uppercase; color: var(--cp-text-muted);">Matrix Condition Number</span>
          <div style="font-family: var(--font-mono); font-size: 13px; color: var(--cp-accent); font-weight: 600;">κ(A) = ||A|| · ||A⁻¹||</div>
          <small style="color: var(--cp-text-muted);">Quantifies worst-case relative error amplification</small>
        </div>
        <div>
          <span style="font-size: 11px; text-transform: uppercase; color: var(--cp-text-muted);">Catastrophic Cancellation</span>
          <div style="font-family: var(--font-mono); font-size: 13px; color: var(--cp-warning); font-weight: 600;">Subtraction of nearly-equal quantities</div>
          <small style="color: var(--cp-text-muted);">Eliminated via algebraic reformulation</small>
        </div>
      </div>
      <div class="cp-formula"><span>Error Propagation</span><code>||δx|| / ||x|| ≤ (κ(A) / (1 - κ(A)·||δA||/||A||)) · (||δb||/||b|| + ||δA||/||A||)</code></div>
    `
  }
};

export function setLabExperiment(experimentId) {
  const select = document.querySelector('#preview-lab-select');
  const kicker = document.querySelector('#preview-lab-kicker');
  const title = document.querySelector('#preview-lab-title');
  const badge = document.querySelector('#preview-lab-badge');
  const description = document.querySelector('#preview-lab-description');
  const content = document.querySelector('#preview-lab-content');
  const navButtons = document.querySelectorAll('.cp-lab-nav[data-lab-id]');

  const exp = EXPERIMENT_PREVIEWS[experimentId] || EXPERIMENT_PREVIEWS.gaussian;

  if (select && select.value !== exp.id) {
    select.value = exp.id;
  }

  navButtons.forEach(btn => {
    const active = btn.dataset.labId === exp.id;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  if (kicker) kicker.textContent = exp.kicker;
  if (title) title.textContent = exp.title;
  if (badge) badge.textContent = exp.badge;
  if (description) description.textContent = exp.description;
  if (content) content.innerHTML = exp.content;
}

function initializeLabDemo() {
  const select = document.querySelector('#preview-lab-select');
  const navButtons = document.querySelectorAll('.cp-lab-nav[data-lab-id]');

  if (select) {
    select.addEventListener('change', () => {
      setLabExperiment(select.value);
    });
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.labId) {
        setLabExperiment(btn.dataset.labId);
      }
    });
  });

  setLabExperiment('gaussian');
}

function initializePreview() {
  document.querySelectorAll('[data-preview-target]').forEach(control => {
    control.addEventListener('click', () => activatePreviewSection(control.dataset.previewTarget));
  });
  document.querySelector('#preview-menu-toggle')?.addEventListener('click', () => {
    document.querySelector('#preview-sidebar')?.classList.add('is-open');
    document.querySelector('#preview-backdrop')?.classList.add('is-visible');
  });
  document.querySelector('#preview-backdrop')?.addEventListener('click', () => {
    document.querySelector('#preview-sidebar')?.classList.remove('is-open');
    document.querySelector('#preview-backdrop')?.classList.remove('is-visible');
  });
  document.querySelector('#preview-open-dialog')?.addEventListener('click', () => {
    document.querySelector('#preview-confirm-dialog')?.showModal();
  });
  document.querySelectorAll('[data-dialog-close]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });
  initializePredictionDemo();
  initializeClassFilter();
  initializeOcrStepper();
  initializeLabDemo();
  activatePreviewSection('overview');
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initializePreview);
}
