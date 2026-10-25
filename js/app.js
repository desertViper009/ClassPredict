/**
 * @file app.js
 * @description Application shell, navigation, and view lifecycle for ClassPredict.
 */

import { stateManager } from './services/state_manager.js';
import { DashboardView } from './ui/dashboard_view.js';
import { DatasetView } from './ui/dataset_view.js';
import { PredictionView } from './ui/prediction_view.js';
import { OCRView } from './ui/ocr_view.js';
import { NumericalLabView } from './ui/numerical_lab_view.js';

const NAVIGATION_ITEMS = Object.freeze([
  { id: 'dashboard', label: 'Overview', tab: 'dashboard' },
  { id: 'dataset', label: 'Dataset Management', tab: 'dataset' },
  { id: 'individual', label: 'Individual Prediction', tab: 'predictions', predictionMode: 'individual' },
  { id: 'class', label: 'Whole-Class Prediction', tab: 'predictions', predictionMode: 'class' },
  { id: 'ocr', label: 'OCR Review', tab: 'ocr' },
  { id: 'lab', label: 'Numerical Methods Lab', tab: 'lab' }
]);

let activeViewInstance = null;
let shell = null;

export function getNavigationModel() {
  return NAVIGATION_ITEMS.map(item => ({ ...item }));
}

function resolveNavigationItem(target, options = {}) {
  const direct = NAVIGATION_ITEMS.find(item => item.id === target);
  if (direct) return direct;
  if (target === 'predictions') {
    return NAVIGATION_ITEMS.find(item => item.id === (options.predictionMode === 'class' ? 'class' : 'individual'));
  }
  return NAVIGATION_ITEMS.find(item => item.tab === target) || NAVIGATION_ITEMS[0];
}

function closeSidebar() {
  shell?.sidebar?.classList.remove('open');
  shell?.backdrop?.classList.remove('active');
  shell?.toggle?.setAttribute('aria-expanded', 'false');
}

function createView(item) {
  if (item.tab === 'dashboard') return new DashboardView(shell.viewContainer);
  if (item.tab === 'dataset') return new DatasetView(shell.viewContainer);
  if (item.tab === 'predictions') {
    const view = new PredictionView(shell.viewContainer);
    view.activeSubtab = item.predictionMode === 'class' ? 'wholeClass' : 'individual';
    return view;
  }
  if (item.tab === 'ocr') return new OCRView(shell.viewContainer);
  if (item.tab === 'lab') return new NumericalLabView(shell.viewContainer);
  return null;
}

export function navigateTo(target, options = {}) {
  if (!shell) return false;
  const item = resolveNavigationItem(target, options);

  if (activeViewInstance && typeof activeViewInstance.destroy === 'function') {
    activeViewInstance.destroy();
  }

  shell.title.textContent = item.label;
  document.title = `${item.label} — ClassPredict`;

  document.querySelectorAll('[data-nav-id]').forEach(control => {
    const active = control.dataset.navId === item.id;
    control.classList.toggle('is-active', active);
    control.classList.toggle('active', active);
    if (control.matches('.nav-link')) {
      control.setAttribute('aria-current', active ? 'page' : 'false');
    }
  });

  activeViewInstance = createView(item);
  activeViewInstance?.init();
  closeSidebar();
  shell.mainContent?.focus({ preventScroll: true });
  return true;
}

function updateDatasetStatus() {
  if (!shell) return;
  const dataset = stateManager.getState().acceptedDataset || [];
  const active = dataset.length > 0;
  const sidebarStatus = document.querySelector('#sidebar-dataset-widget');
  const topbarStatus = document.querySelector('#topbar-dataset-status');

  if (sidebarStatus) {
    sidebarStatus.innerHTML = `
      <span class="cp-status-dot ${active ? '' : 'is-empty'}"></span>
      <span><strong>${active ? 'Dataset active' : 'Session memory'}</strong><small>${active ? `${dataset.length} accepted records` : 'No dataset loaded'}</small></span>
    `;
  }
  if (topbarStatus) {
    topbarStatus.innerHTML = `<span class="cp-status-dot ${active ? '' : 'is-empty'}"></span><span>${active ? `${dataset.length} records` : 'No dataset'}</span>`;
  }
}

function initializeApplication() {
  shell = {
    viewContainer: document.querySelector('#view-container'),
    title: document.querySelector('#page-breadcrumb-title'),
    sidebar: document.querySelector('#app-sidebar'),
    backdrop: document.querySelector('#sidebar-backdrop'),
    toggle: document.querySelector('#sidebar-toggle-btn'),
    mainContent: document.querySelector('#main-content')
  };

  shell.mainContent?.setAttribute('tabindex', '-1');
  shell.toggle?.setAttribute('aria-expanded', 'false');

  document.querySelectorAll('[data-nav-id]').forEach(control => {
    control.addEventListener('click', event => {
      event.preventDefault();
      navigateTo(control.dataset.navId);
    });
  });

  shell.toggle?.addEventListener('click', () => {
    shell.sidebar?.classList.add('open');
    shell.backdrop?.classList.add('active');
    shell.toggle?.setAttribute('aria-expanded', 'true');
  });
  document.querySelector('#sidebar-toggle-close')?.addEventListener('click', closeSidebar);
  shell.backdrop?.addEventListener('click', closeSidebar);

  document.querySelector('#btn-header-demo')?.addEventListener('click', () => navigateTo('dataset'));

  stateManager.subscribe(updateDatasetStatus);
  updateDatasetStatus();
  navigateTo('dashboard');

  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        console.warn('[ClassPredict] Service worker registration unavailable:', error);
      });
    });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initializeApplication);
}
