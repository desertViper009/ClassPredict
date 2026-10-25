/**
 * @file app.js
 * @description Application initialization and client-side view router for ClassPredict.
 * Phase 3: Dataset Management Layer & CSV Validation Active.
 */

import { DashboardView } from './ui/dashboard_view.js';
import { DatasetView } from './ui/dataset_view.js';
import { PredictionView } from './ui/prediction_view.js';
import { OCRView } from './ui/ocr_view.js';
import { NumericalLabView } from './ui/numerical_lab_view.js';

let activeViewInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  console.log('[ClassPredict] Initializing Phase 10: Production Release Active...');

  const tabButtons = document.querySelectorAll('.nav-link[data-tab]');
  const viewContainer = document.getElementById('view-container');

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

  // Synthetic Demonstration Mode Header Button
  const btnHeaderDemo = document.getElementById('btn-header-demo');
  if (btnHeaderDemo) {
    btnHeaderDemo.addEventListener('click', (e) => {
      e.preventDefault();
      const msg = "Synthetic Demonstration Mode\n\n" +
        "• All demonstration data uses synthetic pseudonymous identifiers (SYN_001 to SYN_013).\n" +
        "• Zero real student records, roll numbers, or personal details are ever stored or transmitted.\n" +
        "• Real mark sheets processed via OCR must be human-reviewed and key-reconciled.\n\n" +
        "Would you like to navigate to Dataset Ingestion to review or load the synthetic sample?";
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

  console.log('[ClassPredict] Phase 10 initialized successfully.');
});

/**
 * Renders tab placeholder view for subsequent milestones (Phases 4 through 8).
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
    predictions: 'Individual student trajectory forecasting and whole-class batch transition modeling (Scheduled for Phase 6).',
    ocr: 'Client-side PDF canvas cropping, WebAssembly OCR extraction, and key reconciliation (Scheduled for Phase 7).',
    lab: 'Interactive linear least squares with centering, degree-2 polynomial fitting, and Newton divided differences (Scheduled for Phase 4).'
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
        <span class="badge badge-crimson">Phase Milestone Scheduled</span>
      </div>
      <div style="padding: var(--space-xl) 0; text-align: center; color: var(--text-secondary); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">
        <p style="font-size: 16px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;">
          Component Planned & Designed
        </p>
        <p style="font-size: 13px; max-width: 600px; margin: 0 auto; color: var(--text-secondary);">
          The mathematical models, privacy boundaries, and validation algorithms for this view have been formally specified in the project documentation. Implementation proceeds in accordance with the phased roadmap.
        </p>
        <div style="margin-top: 16px;">
          <a href="#" class="btn btn-secondary" onclick="document.getElementById('tab-btn-dashboard').click(); return false;" style="font-size: 13px;">
            ← Return to Dataset Management
          </a>
        </div>
      </div>
    </div>
  `;
}
