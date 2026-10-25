export function getPreviewModel() {
  return {
    productName: 'ClassPredict',
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

function initializeLabDemo() {
  const select = document.querySelector('#preview-lab-select');
  const output = document.querySelector('#preview-lab-description');
  if (!select || !output) return;
  const descriptions = {
    gaussian: 'Trace row swaps, scale-aware pivots, elimination multipliers, and back substitution.',
    regression: 'Compare linear and quadratic least-squares fits on the same synthetic observations.',
    newton: 'Inspect the divided-difference table and evaluate the Newton polynomial.',
    runge: 'Compare equally spaced and Chebyshev nodes on the Runge function.',
    stability: 'Study residuals, conditioning, and floating-point error propagation.'
  };
  select.addEventListener('change', () => {
    output.textContent = descriptions[select.value];
  });
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
