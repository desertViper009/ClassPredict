/**
 * @file app.js
 * @description Application initialization and client-side view router for ClassPredict.
 * Premium Dark Cinematic SaaS Layout with Persistent Sidebar & Responsive Drawer.
 */

import { stateManager } from './services/state_manager.js';
import { DashboardView } from './ui/dashboard_view.js';
import { DatasetView } from './ui/dataset_view.js';
import { PredictionView } from './ui/prediction_view.js';
import { OCRView } from './ui/ocr_view.js';
import { NumericalLabView } from './ui/numerical_lab_view.js';

let activeViewInstance = null;

const TAB_TITLES = {
  dashboard: 'Overview Dashboard',
  dataset: 'Dataset Management',
  predictions: 'SGPA Predictions',
  ocr: 'OCR Review & Reconciliation',
  lab: 'Numerical Methods Lab'
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('[ClassPredict] Initializing Premium SaaS UI...');

  const tabButtons = document.querySelectorAll('.nav-link[data-tab]');
  const viewContainer = document.getElementById('view-container');
  const breadcrumbTitle = document.getElementById('page-breadcrumb-title');
  const sidebar = document.getElementById('app-sidebar');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebarToggleClose = document.getElementById('sidebar-toggle-close');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

  // Register Production Service Worker
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('[ClassPredict] Service Worker registered with scope:', reg.scope);
      }).catch((err) => {
        console.warn('[ClassPredict] Service Worker registration failed:', err);
      });
    });
  }

  // Monitor network connectivity for offline shell indicator
  const netBadge = document.getElementById('net-status-badge');
  function updateNetworkStatus() {
    if (!netBadge) return;
    if (navigator.onLine) {
      netBadge.textContent = 'Online';
      netBadge.className = 'badge badge-emerald';
      netBadge.title = 'Network status: connected; all computation remains strictly local.';
    } else {
      netBadge.textContent = 'Offline Shell';
      netBadge.className = 'badge badge-warning';
      netBadge.title = 'Network status: offline; cached application shell active.';
    }
  }
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // Mobile Sidebar Drawer Controls
  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
  }

  if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', openSidebar);
  if (sidebarToggleClose) sidebarToggleClose.addEventListener('click', closeSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

  // Reactive Sidebar Dataset Widget
  function updateSidebarWidget() {
    const widget = document.getElementById('sidebar-dataset-widget');
    if (!widget) return;
    const state = stateManager.getState();
    const hasData = state.acceptedDataset && state.acceptedDataset.length > 0;
    if (hasData) {
      widget.innerHTML = `
        <div class="status-title">Session State</div>
        <div class="status-body">
          <span>Active Dataset</span>
          <span class="badge badge-success" style="font-size: 10px;">${state.acceptedDataset.length} rows</span>
        </div>
      `;
    } else {
      widget.innerHTML = `
        <div class="status-title">Session State</div>
        <div class="status-body">
          <span>Session Memory</span>
          <span class="badge badge-neutral" style="font-size: 10px;">Empty</span>
        </div>
      `;
    }
  }
  stateManager.subscribe(updateSidebarWidget);
  updateSidebarWidget();

  // Synthetic Demonstration Mode Header Button
  const btnHeaderDemo = document.getElementById('btn-header-demo');
  if (btnHeaderDemo) {
    btnHeaderDemo.addEventListener('click', (e) => {
      e.preventDefault();
      const msg = "Synthetic Demonstration Mode\n\n" +
        "• All demonstration data uses synthetic pseudonymous identifiers (SYN_001 to SYN_013).\n" +
        "• Zero real student records, roll numbers, or personal details are ever stored or transmitted.\n" +
        "• Real mark sheets processed via OCR must be human-reviewed and key-reconciled.\n\n" +
        "Would you like to navigate to Dataset Management to review or load the synthetic sample?";
      if (confirm(msg)) {
        const datasetTab = document.getElementById('tab-btn-dataset');
        if (datasetTab) datasetTab.click();
      }
    });
  }

  // Brand Home link
  const brandHome = document.getElementById('brand-home');
  if (brandHome) {
    brandHome.addEventListener('click', (e) => {
      e.preventDefault();
      const dashTab = document.getElementById('tab-btn-dashboard');
      if (dashTab) dashTab.click();
    });
  }

  // Switch view helper
  function switchTab(tabName) {
    if (activeViewInstance && typeof activeViewInstance.destroy === 'function') {
      activeViewInstance.destroy();
      activeViewInstance = null;
    }

    if (breadcrumbTitle) {
      breadcrumbTitle.textContent = TAB_TITLES[tabName] || 'Overview Dashboard';
    }

    if (tabName === 'dashboard') {
      activeViewInstance = new DashboardView(viewContainer);
      activeViewInstance.init();
    } else if (tabName === 'dataset') {
      activeViewInstance = new DatasetView(viewContainer);
      activeViewInstance.init();
    } else if (tabName === 'predictions') {
      activeViewInstance = new PredictionView(viewContainer);
      activeViewInstance.init();
    } else if (tabName === 'ocr') {
      activeViewInstance = new OCRView(viewContainer);
      activeViewInstance.init();
    } else if (tabName === 'lab') {
      activeViewInstance = new NumericalLabView(viewContainer);
      activeViewInstance.init();
    } else {
      renderTabPlaceholder(tabName, viewContainer);
    }

    closeSidebar();
  }

  // Bind Tab Click Listeners
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = button.getAttribute('data-tab');

      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');

      switchTab(targetTab);
    });
  });

  // Mount default view (Dashboard view)
  switchTab('dashboard');

  console.log('[ClassPredict] UI successfully initialized.');
});

/**
 * Renders tab placeholder view.
 * @param {string} tabName 
 * @param {HTMLElement} container 
 */
function renderTabPlaceholder(tabName, container) {
  const titles = {
    predictions: 'SGPA Trajectory Predictions',
    ocr: 'Privacy-Preserving OCR Ingestion',
    lab: 'Numerical Methods Educational Lab'
  };

  const descriptions = {
    predictions: 'Individual student trajectory forecasting and whole-class batch transition modeling.',
    ocr: 'Client-side PDF canvas cropping, WebAssembly OCR extraction, and key reconciliation.',
    lab: 'Interactive linear least squares with centering, degree-2 polynomial fitting, and Newton divided differences.'
  };

  const title = titles[tabName] || 'Workspace';
  const desc = descriptions[tabName] || 'Active workspace.';

  container.innerHTML = `
    <div class="card" style="margin-bottom: var(--space-xl);">
      <div class="card-header">
        <div>
          <h2 class="card-title">${title}</h2>
          <p class="card-subtitle">${desc}</p>
        </div>
        <span class="badge badge-crimson">Module Active</span>
      </div>
      <div style="padding: var(--space-xl) 0; text-align: center; color: var(--color-muted); border: 1px dashed var(--color-border); border-radius: var(--radius-md);">
        <p style="font-size: 16px; font-weight: 500; color: var(--color-text); margin-bottom: 8px;">
          Workspace View
        </p>
        <p style="font-size: 13px; max-width: 600px; margin: 0 auto; color: var(--color-muted);">
          Module available and active.
        </p>
        <div style="margin-top: 16px;">
          <a href="#" class="btn btn-secondary" onclick="document.getElementById('tab-btn-dashboard').click(); return false;" style="font-size: 13px;">
            ← Return to Dashboard
          </a>
        </div>
      </div>
    </div>
  `;
}
