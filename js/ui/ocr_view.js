/**
 * @file ocr_view.js
 * @description Presentation layer component for Phase 7 Privacy-Preserving OCR Ingestion & Key Reconciliation.
 * Enforces local crop isolation, interactive canvas bounding boxes, Web Worker OCR execution,
 * editable candidate auditing, and atomic dataset commitment.
 * Document Reference: docs/UI_UX_DESIGN.md, docs/REQUIREMENTS.md (FR-05), docs/adr/ADR-004-ocr-and-privacy-workflow.md
 */

import { stateManager } from '../services/state_manager.js';
import { ocrService } from '../services/ocr_service.js';
import { generateUniqueStudentKey } from '../core/ocr_engine.js';
import { DEFAULT_SCALE_MAX } from '../core/data_validator.js';

export class OCRView {
  /**
   * @param {HTMLElement} container - DOM container element
   */
  constructor(container) {
    this.container = container;
    this.unsubscribe = null;

    // Workflow steps: 'UPLOAD' | 'CROP' | 'RECOGNIZING' | 'REVIEW' | 'COMMITTED'
    this.currentStep = 'UPLOAD';

    // State
    this.targetSemester = 1;
    this.ocrProgress = { status: 'idle', progress: 0 };
    this.ocrError = null;
    this.commitErrors = [];
    this.commitSummary = null;

    // Interactive Crop State (Display coordinates relative to displayed canvas)
    this.displayCrop = { x: 100, y: 80, width: 140, height: 320 };
    this.isDragging = false;
    this.dragMode = 'move'; // 'move' | 'nw' | 'se' | 'sw' | 'ne'
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.initialCrop = null;

    // Active candidates under review
    this.reviewedCandidates = [];
  }

  /**
   * Initializes view and subscribes to state manager.
   */
  init() {
    this._initializeTargetSemester();
    this.render();

    this.unsubscribe = stateManager.subscribe(() => {
      // Re-render if in relevant states
      if (this.currentStep === 'UPLOAD' || this.currentStep === 'COMMITTED') {
        this.render();
      }
    });
  }

  /**
   * Cleans up subscription and in-memory OCR buffers on destroy.
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    ocrService.discardTemporaryState();
  }

  /**
   * Sets default target semester based on currently accepted dataset in memory.
   * @private
   */
  _initializeTargetSemester() {
    const state = stateManager.getState();
    if (state.acceptedSummary && state.acceptedSummary.semesterRange) {
      this.targetSemester = Math.min(12, state.acceptedSummary.semesterRange.max + 1);
    } else {
      this.targetSemester = 1;
    }
  }

  /**
   * Primary render method.
   */
  render() {
    const state = stateManager.getState();
    const hasAccepted = !!(state.acceptedDataset && state.acceptedDataset.length > 0);

    this.container.innerHTML = `
      <!-- Workspace Header -->
      <div class="card" style="margin-bottom: var(--space-xl);">
        <div class="card-header">
          <div>
            <h2 class="card-title">Privacy-Preserving OCR Ingestion & Key Reconciliation</h2>
            <p class="card-subtitle">Local document rasterization, column-restricted cropping, Web Worker OCR, and stable student-key mapping (Phase 7)</p>
          </div>
          <div>
            ${hasAccepted 
              ? `<span class="badge badge-success">● Active Cohort: ${state.acceptedSummary.totalStudents} Students</span>` 
              : '<span class="badge badge-synthetic">No Accepted Cohort (First Semester Import)</span>'}
          </div>
        </div>

        <!-- Privacy & Ethical Boundary Notice -->
        <div style="background-color: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-md);">
          <div style="display: flex; gap: var(--space-sm); align-items: flex-start;">
            <div style="font-size: 20px; line-height: 1;">🛡️</div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
              <strong style="color: var(--text-primary);">Privacy Architecture Guarantee:</strong>
              ClassPredict executes all PDF rasterization, image cropping, and optical character recognition locally inside your browser memory.
              <strong>Zero document bytes, image crops, or grades are transmitted over the network.</strong>
              You are required to crop <em>strictly</em> around the numeric SGPA column so student names and registration numbers are never passed to the OCR engine.
            </div>
          </div>
        </div>

        <!-- Workflow Step Indicator -->
        <div style="display: flex; gap: var(--space-xs); border-top: 1px solid var(--border-subtle); padding-top: var(--space-md); flex-wrap: wrap;">
          <span class="badge ${this.currentStep === 'UPLOAD' ? 'badge-crimson' : 'badge-gray'}">1. Upload Document</span>
          <span style="color: var(--text-tertiary);">→</span>
          <span class="badge ${this.currentStep === 'CROP' || this.currentStep === 'RECOGNIZING' ? 'badge-crimson' : 'badge-gray'}">2. Isolate SGPA Column</span>
          <span style="color: var(--text-tertiary);">→</span>
          <span class="badge ${this.currentStep === 'REVIEW' ? 'badge-crimson' : 'badge-gray'}">3. Review & Reconcile Keys</span>
          <span style="color: var(--text-tertiary);">→</span>
          <span class="badge ${this.currentStep === 'COMMITTED' ? 'badge-success' : 'badge-gray'}">4. Atomic Commitment</span>
        </div>
      </div>

      <!-- Active Stage Container -->
      <div id="ocr-stage-container">
        ${this._renderCurrentStage(state)}
      </div>
    `;

    this.bindEvents();
  }

  /**
   * Renders the view content for the active workflow stage.
   * @private
   */
  _renderCurrentStage(state) {
    switch (this.currentStep) {
      case 'UPLOAD':
        return this._renderUploadStage();
      case 'CROP':
        return this._renderCropStage();
      case 'RECOGNIZING':
        return this._renderRecognizingStage();
      case 'REVIEW':
        return this._renderReviewStage(state);
      case 'COMMITTED':
        return this._renderCommittedStage();
      default:
        return this._renderUploadStage();
    }
  }

  /**
   * Stage 1: Document Upload dropzone.
   * @private
   */
  _renderUploadStage() {
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title" style="font-size: 16px;">Select Marksheet Document</h3>
            <p class="card-subtitle">Upload university result sheets in PDF, PNG, JPG, or WEBP format (Max 15 MB)</p>
          </div>
          <button class="btn btn-secondary" id="btn-load-synthetic-marksheet" style="font-size: 12px; padding: 6px 12px;">
            Load Synthetic Demo Marksheet
          </button>
        </div>

        ${this.ocrError ? `
          <div class="callout callout-crimson" style="margin-bottom: var(--space-md);">
            <strong>Upload Error:</strong> ${this.ocrError}
          </div>
        ` : ''}

        <div class="dropzone" id="ocr-dropzone">
          <input type="file" id="ocr-file-input" accept=".pdf,.png,.jpg,.jpeg,.webp" title="Select marksheet document">
          <div class="dropzone-icon">📄</div>
          <div class="dropzone-title">Select or Drag & Drop Result Sheet (PDF / Image)</div>
          <div class="dropzone-subtitle">Client-Side Processing • Sandboxed Memory • Zero Cloud API Transmission</div>
          <button class="btn btn-primary" type="button" style="pointer-events: none;">Browse Files</button>
        </div>
      </div>
    `;
  }

  /**
   * Stage 2: Page Selection, Document Rotation & Interactive Crop Boundary.
   * @private
   */
  _renderCropStage() {
    const isPdf = ocrService.fileType === 'pdf';
    const pageCount = ocrService.pageCount;
    const currPage = ocrService.currentPageNumber;
    const rot = ocrService.rotationAngle;

    return `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: var(--space-md);">
          <div>
            <h3 class="card-title" style="font-size: 16px;">Step 2: Isolate SGPA Column Boundary</h3>
            <p class="card-subtitle">Drag and position the red crop rectangle over <strong>ONLY the SGPA column</strong>.</p>
          </div>

          <!-- Document Controls (Pages & Rotation) -->
          <div style="display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap;">
            ${isPdf && pageCount > 1 ? `
              <div style="display: flex; align-items: center; gap: 4px; background-color: var(--bg-primary); padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <button class="btn btn-secondary" id="btn-prev-page" style="padding: 4px 8px; font-size: 12px;" ${currPage <= 1 ? 'disabled' : ''}>◀</button>
                <span style="font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); padding: 0 6px;">
                  Page ${currPage} of ${pageCount}
                </span>
                <button class="btn btn-secondary" id="btn-next-page" style="padding: 4px 8px; font-size: 12px;" ${currPage >= pageCount ? 'disabled' : ''}>▶</button>
              </div>
            ` : ''}

            <button class="btn btn-secondary" id="btn-rotate-cw" style="font-size: 12px; padding: 6px 12px;" title="Rotate page 90 degrees clockwise">
              ↻ Rotate 90° (${rot}°)
            </button>
            <button class="btn btn-secondary" id="btn-cancel-crop" style="font-size: 12px; padding: 6px 12px;">
              ✕ Change File
            </button>
          </div>
        </div>

        <!-- Privacy Instructions Banner -->
        <div class="callout callout-amber" style="margin-bottom: var(--space-md);">
          <strong>Strict Privacy Requirement:</strong> Ensure that student names, roll numbers, registration numbers, and unrelated grade columns remain <strong>outside</strong> the red box. Only pixels within the box are sent to the local OCR worker.
        </div>

        <!-- Interactive Canvas Stage -->
        <div class="ocr-canvas-container" id="ocr-canvas-container">
          <div class="ocr-canvas-inner" id="ocr-canvas-inner">
            <canvas id="ocr-document-canvas" class="ocr-document-canvas"></canvas>
            
            <!-- Interactive Crop Box Overlay -->
            <div id="ocr-crop-box" class="ocr-crop-box" 
                 style="left: ${this.displayCrop.x}px; top: ${this.displayCrop.y}px; width: ${this.displayCrop.width}px; height: ${this.displayCrop.height}px;">
              <span class="ocr-crop-label">SGPA Column Crop</span>
            </div>
          </div>
        </div>

        <!-- Action Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-md); flex-wrap: wrap; gap: var(--space-sm);">
          <div style="font-size: 12px; color: var(--text-tertiary); font-family: var(--font-mono);">
            Crop: (${this.displayCrop.x}, ${this.displayCrop.y}) • ${this.displayCrop.width} × ${this.displayCrop.height} px
          </div>
          <button class="btn btn-primary" id="btn-run-ocr" style="padding: 10px 20px; font-size: 14px;">
            ⚡ Run Local OCR on Crop
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Stage 3: OCR Progress indicator.
   * @private
   */
  _renderRecognizingStage() {
    return `
      <div class="card" style="text-align: center; padding: var(--space-2xl) var(--space-lg);">
        <div style="font-size: 36px; margin-bottom: var(--space-sm); color: var(--accent-primary);">⚡</div>
        <h3 class="card-title" style="margin-bottom: 6px;">Running Local OCR Engine</h3>
        <p class="card-subtitle" style="max-width: 500px; margin: 0 auto var(--space-md) auto;">
          Tesseract.js Web Worker is extracting numeric SGPA values from the cropped column. Processing occurs strictly within local browser memory.
        </p>

        <div style="max-width: 400px; margin: 0 auto;">
          <div class="ocr-progress-bar">
            <div class="ocr-progress-fill" style="width: ${this.ocrProgress.progress}%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-tertiary); font-family: var(--font-mono); margin-top: 4px;">
            <span>${this.ocrProgress.status}</span>
            <span>${this.ocrProgress.progress}%</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Stage 4: Editable Row-by-Row Review & Key Reconciliation Barrier.
   * @private
   */
  _renderReviewStage(state) {
    const existingKeys = (state.acceptedDataset || []).map(r => r.student_key);
    const uniqueExistingKeys = Array.from(new Set(existingKeys));

    return `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: var(--space-md);">
          <div>
            <h3 class="card-title" style="font-size: 16px;">Step 3: Human Review & Stable Student-Key Reconciliation</h3>
            <p class="card-subtitle">Verify recognized SGPA numbers and explicitly map each candidate row to a stable student key.</p>
          </div>

          <!-- Marksheet Target Semester Selector -->
          <div style="display: flex; align-items: center; gap: var(--space-sm);">
            <label for="input-target-semester" style="font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">
              Semester Number:
            </label>
            <input type="number" id="input-target-semester" class="form-control font-mono" 
                   min="1" max="12" step="1" 
                   value="${this.targetSemester}" 
                   style="width: 70px; padding: 6px 8px; font-size: 14px;">
          </div>
        </div>

        <!-- Ethical Key Reconciliation Notice -->
        <div class="callout callout-info" style="margin-bottom: var(--space-md);">
          <strong>Mandatory Identity Safeguard:</strong>
          Student identity is <strong>never</strong> inferred from OCR row order, because cohort ordering often changes across semester mark sheets.
          For each candidate, explicitly assign their stable pseudonymous key using the dropdown (or create a new unique key for newly enrolled students).
        </div>

        ${this.commitErrors.length > 0 ? `
          <div class="alert alert-error" style="margin-bottom: var(--space-md);">
            <h4>Cannot Commit Proposed Import:</h4>
            <ul>
              ${this.commitErrors.map(e => `<li>${e}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- Candidate Rows Review Table -->
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 50px;">Crop #</th>
                <th style="width: 140px;">Raw OCR Text</th>
                <th style="width: 120px;">Extracted SGPA</th>
                <th>Confidence & Diagnostic Status</th>
                <th style="width: 220px;">Reconciled Student Key</th>
                <th style="width: 120px;">Key Type</th>
                <th style="width: 60px;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.reviewedCandidates.length === 0 ? `
                <tr>
                  <td colspan="7" style="text-align: center; padding: var(--space-xl); color: var(--text-tertiary);">
                    No candidates recognized in the selected crop. Please adjust crop boundary and retry.
                  </td>
                </tr>
              ` : this.reviewedCandidates.map((cand, idx) => {
                const statusBadge = this._getCandidateBadge(cand);
                return `
                  <tr data-index="${idx}">
                    <td style="color: var(--text-tertiary); font-weight: 600;">#${cand.cropSequence}</td>
                    <td style="color: var(--text-secondary); font-size: 12px;">
                      <code style="background-color: var(--bg-primary); padding: 2px 4px; border-radius: 2px;">${cand.rawText || '—'}</code>
                    </td>
                    <td>
                      <input type="text" class="ocr-review-input candidate-sgpa-input" 
                             data-index="${idx}" 
                             value="${cand.extractedSgpa !== null ? cand.extractedSgpa : ''}" 
                             placeholder="0.00"
                             aria-label="SGPA value for row #${cand.cropSequence}">
                    </td>
                    <td>
                      <div style="display: flex; flex-direction: column; gap: 2px;">
                        <div>${statusBadge}</div>
                        ${cand.warnings && cand.warnings.length > 0 ? `
                          <div style="font-size: 11px; color: var(--accent-warning); line-height: 1.3;">
                            ${cand.warnings.join(' ')}
                          </div>
                        ` : ''}
                      </div>
                    </td>
                    <td>
                      <div style="display: flex; gap: 4px; align-items: center;">
                        <select class="ocr-review-select candidate-key-select" data-index="${idx}" aria-label="Student key for row #${cand.cropSequence}">
                          <option value="">-- Select Student Key --</option>
                          ${uniqueExistingKeys.map(k => `
                            <option value="${k}" ${cand.assignedKey === k ? 'selected' : ''}>${k} (Cohort)</option>
                          `).join('')}
                          <option value="__NEW__" ${cand.isNewStudent ? 'selected' : ''}>+ New Student Key...</option>
                        </select>
                        ${cand.isNewStudent ? `
                          <input type="text" class="form-control font-mono candidate-custom-key-input" 
                                 data-index="${idx}" 
                                 value="${cand.assignedKey || ''}" 
                                 placeholder="SYN_XXX" 
                                 style="width: 100px; padding: 4px 6px; font-size: 12px;">
                        ` : ''}
                      </div>
                    </td>
                    <td>
                      ${cand.isNewStudent 
                        ? '<span class="badge badge-synthetic">NEW</span>' 
                        : (cand.assignedKey ? '<span class="badge badge-success">EXISTING</span>' : '<span class="badge badge-gray">UNASSIGNED</span>')}
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-delete-row" data-index="${idx}" title="Delete candidate row" style="padding: 4px 8px; font-size: 11px;">
                        ✕
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Table Row Operations -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-md); flex-wrap: wrap; gap: var(--space-sm);">
          <button class="btn btn-secondary" id="btn-add-manual-row" style="font-size: 12px;">
            + Add Missing Student Row
          </button>
          <div style="font-size: 12px; color: var(--text-tertiary);">
            Showing ${this.reviewedCandidates.length} candidate rows
          </div>
        </div>

        <!-- Commit Actions Bar -->
        <div class="action-bar" style="border-top: 1px solid var(--border-subtle); padding-top: var(--space-md); margin-top: var(--space-lg); justify-content: space-between;">
          <div style="display: flex; gap: var(--space-sm);">
            <button class="btn btn-secondary" id="btn-back-to-crop">
              ← Re-adjust Crop Boundary
            </button>
            <button class="btn btn-secondary" id="btn-discard-import">
              ✕ Discard Import
            </button>
          </div>
          <button class="btn btn-primary" id="btn-confirm-commit" style="padding: 10px 24px; font-size: 14px;">
            ✓ Confirm & Commit to Dataset
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Stage 5: Success summary after atomic commitment.
   * @private
   */
  _renderCommittedStage() {
    const state = stateManager.getState();
    const summary = state.acceptedSummary;

    return `
      <div class="card" style="text-align: center; padding: var(--space-2xl) var(--space-lg);">
        <div style="font-size: 40px; margin-bottom: var(--space-sm); color: var(--accent-success);">✓</div>
        <h3 class="card-title" style="margin-bottom: 6px;">Marksheet Import Committed Successfully</h3>
        <p class="card-subtitle" style="max-width: 550px; margin: 0 auto var(--space-lg) auto;">
          The reviewed and reconciled semester records have been atomically merged into active session memory. The predictive transition models are now updated with this data.
        </p>

        <!-- KPI Grid -->
        <div class="kpi-grid" style="max-width: 800px; margin: 0 auto var(--space-xl) auto; text-align: left;">
          <div class="kpi-card">
            <div class="kpi-label">Total Cohort Students</div>
            <div class="kpi-value">${summary ? summary.totalStudents : 0}</div>
            <div class="kpi-meta">Distinct student keys</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Semester Records</div>
            <div class="kpi-value" style="color: var(--accent-success);">${summary ? summary.totalRecords : 0}</div>
            <div class="kpi-meta">Accepted grade entries</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Semester Range</div>
            <div class="kpi-value" style="color: var(--accent-info);">
              ${summary && summary.semesterRange ? `Sem ${summary.semesterRange.min}–${summary.semesterRange.max}` : 'N/A'}
            </div>
            <div class="kpi-meta">Observed academic horizon</div>
          </div>
        </div>

        <!-- Action Links -->
        <div style="display: flex; gap: var(--space-md); justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-goto-predictions">
            📊 View Updated Predictions
          </button>
          <button class="btn btn-secondary" id="btn-goto-dataset">
            📁 Inspect in Dataset Management
          </button>
          <button class="btn btn-secondary" id="btn-ingest-another">
            + Ingest Another Marksheet
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Helper to format candidate status badge.
   * @private
   */
  _getCandidateBadge(cand) {
    switch (cand.status) {
      case 'VALID':
        return `<span class="badge badge-success">✓ VALID (${cand.confidence.toFixed(0)}%)</span>`;
      case 'DECIMAL_AMBIGUOUS':
        return `<span class="badge badge-amber">⚠ DECIMAL AMBIGUITY (${cand.confidence.toFixed(0)}%)</span>`;
      case 'AMBIGUOUS':
        return `<span class="badge badge-amber">⚠ MULTIPLE NUMBERS</span>`;
      case 'OUT_OF_SCALE':
        return `<span class="badge badge-amber">⚠ OUT OF SCALE</span>`;
      case 'LOW_CONFIDENCE':
        return `<span class="badge badge-amber">⚠ LOW CONFIDENCE (${cand.confidence.toFixed(0)}%)</span>`;
      case 'UNREADABLE':
      case 'INVALID':
      default:
        return `<span class="badge badge-crimson">✕ UNREADABLE</span>`;
    }
  }

  /**
   * Binds user event listeners across all stages.
   */
  bindEvents() {
    if (this.currentStep === 'UPLOAD') {
      this._bindUploadEvents();
    } else if (this.currentStep === 'CROP') {
      this._bindCropEvents();
    } else if (this.currentStep === 'REVIEW') {
      this._bindReviewEvents();
    } else if (this.currentStep === 'COMMITTED') {
      this._bindCommittedEvents();
    }
  }

  /**
   * Event listeners for Upload Stage.
   * @private
   */
  _bindUploadEvents() {
    const dropzone = this.container.querySelector('#ocr-dropzone');
    const fileInput = this.container.querySelector('#ocr-file-input');
    const btnSynthetic = this.container.querySelector('#btn-load-synthetic-marksheet');

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          await this._handleFileUpload(e.target.files[0]);
        }
      });
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          await this._handleFileUpload(e.dataTransfer.files[0]);
        }
      });
    }

    if (btnSynthetic) {
      btnSynthetic.addEventListener('click', async () => {
        await this._handleLoadSyntheticMarksheet();
      });
    }
  }

  /**
   * Handles user file selection.
   * @private
   */
  async _handleFileUpload(file) {
    this.ocrError = null;
    const res = await ocrService.loadDocument(file);
    if (res.success) {
      this.currentStep = 'CROP';
      this.render();
      await this._drawDocumentToCanvas();
    } else {
      this.ocrError = res.error;
      this.render();
    }
  }

  /**
   * Generates and loads an in-memory synthetic demo marksheet image for instant testing.
   * @private
   */
  async _handleLoadSyntheticMarksheet() {
    this.ocrError = null;

    // Create an in-memory canvas representing a realistic university marksheet
    const demoCanvas = document.createElement('canvas');
    demoCanvas.width = 800;
    demoCanvas.height = 1000;
    const ctx = demoCanvas.getContext('2d');

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 800, 1000);

    // Header (Contains names and registration numbers - precisely what should NOT be cropped)
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText("STATE UNIVERSITY OF ENGINEERING & TECHNOLOGY", 100, 60);
    ctx.font = '14px sans-serif';
    ctx.fillText(`DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING • SEMESTER ${this.targetSemester} RESULT SHEET`, 120, 90);

    // Table Header
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(50, 130, 700, 30);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 12px monospace';
    ctx.fillText("SL", 60, 150);
    ctx.fillText("STUDENT NAME (DO NOT CROP)", 110, 150);
    ctx.fillText("ROLL NO (DO NOT CROP)", 380, 150);
    ctx.fillText("SGPA (CROP HERE)", 580, 150);

    // Sample Rows
    const sampleGrades = [
      { name: "Synthetic Student Alpha", roll: "2023-CS-01", sgpa: "3.45" },
      { name: "Synthetic Student Beta", roll: "2023-CS-02", sgpa: "3.62" },
      { name: "Synthetic Student Gamma", roll: "2023-CS-03", sgpa: "3.28" },
      { name: "Synthetic Student Delta", roll: "2023-CS-04", sgpa: "3.80" },
      { name: "Synthetic Student Epsilon", roll: "2023-CS-05", sgpa: "3.55" }
    ];

    ctx.font = '13px monospace';
    sampleGrades.forEach((row, i) => {
      const y = 190 + i * 40;
      ctx.fillStyle = '#374151';
      ctx.fillText(String(i + 1), 60, y);
      ctx.fillText(row.name, 110, y);
      ctx.fillText(row.roll, 380, y);

      // SGPA column (isolated target)
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(row.sgpa, 600, y);
      ctx.font = '13px monospace';

      ctx.strokeStyle = '#F3F4F6';
      ctx.beginPath();
      ctx.moveTo(50, y + 10);
      ctx.lineTo(750, y + 10);
      ctx.stroke();
    });

    demoCanvas.toBlob(async (blob) => {
      const file = new File([blob], `synthetic_semester_${this.targetSemester}_marksheet.png`, { type: 'image/png' });
      await this._handleFileUpload(file);
    });
  }

  /**
   * Draws document page to destination canvas and aligns crop box.
   * @private
   */
  async _drawDocumentToCanvas() {
    const canvas = this.container.querySelector('#ocr-document-canvas');
    if (!canvas) return;

    try {
      await ocrService.renderPageToCanvas(canvas, ocrService.currentPageNumber);
      
      // Initialize a default crop position over the SGPA column
      const dispW = canvas.clientWidth || 800;
      const dispH = canvas.clientHeight || 1000;

      // Position crop over right-hand column (where SGPA typically resides)
      this.displayCrop = {
        x: Math.round(dispW * 0.70),
        y: Math.round(dispH * 0.16),
        width: Math.max(120, Math.round(dispW * 0.22)),
        height: Math.max(220, Math.round(dispH * 0.45))
      };

      this._updateCropBoxDOM();
    } catch (err) {
      this.ocrError = err.message;
      this.currentStep = 'UPLOAD';
      this.render();
    }
  }

  /**
   * Updates CSS position and dimensions of the crop box DOM element.
   * @private
   */
  _updateCropBoxDOM() {
    const box = this.container.querySelector('#ocr-crop-box');
    if (box) {
      box.style.left = `${this.displayCrop.x}px`;
      box.style.top = `${this.displayCrop.y}px`;
      box.style.width = `${this.displayCrop.width}px`;
      box.style.height = `${this.displayCrop.height}px`;
    }
  }

  /**
   * Event listeners for Crop Stage.
   * @private
   */
  _bindCropEvents() {
    const btnRotate = this.container.querySelector('#btn-rotate-cw');
    const btnPrevPage = this.container.querySelector('#btn-prev-page');
    const btnNextPage = this.container.querySelector('#btn-next-page');
    const btnCancel = this.container.querySelector('#btn-cancel-crop');
    const btnRunOcr = this.container.querySelector('#btn-run-ocr');
    const cropBox = this.container.querySelector('#ocr-crop-box');
    const canvasContainer = this.container.querySelector('#ocr-canvas-inner');

    if (btnRotate) {
      btnRotate.addEventListener('click', async () => {
        ocrService.rotateClockwise();
        await this._drawDocumentToCanvas();
      });
    }

    if (btnPrevPage) {
      btnPrevPage.addEventListener('click', async () => {
        if (ocrService.currentPageNumber > 1) {
          ocrService.currentPageNumber--;
          await this._drawDocumentToCanvas();
        }
      });
    }

    if (btnNextPage) {
      btnNextPage.addEventListener('click', async () => {
        if (ocrService.currentPageNumber < ocrService.pageCount) {
          ocrService.currentPageNumber++;
          await this._drawDocumentToCanvas();
        }
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        ocrService.discardTemporaryState();
        this.currentStep = 'UPLOAD';
        this.render();
      });
    }

    if (btnRunOcr) {
      btnRunOcr.addEventListener('click', async () => {
        await this._executeOcrPipeline();
      });
    }

    // Interactive crop dragging
    if (cropBox && canvasContainer) {
      cropBox.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.initialCrop = { ...this.displayCrop };
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;

        const canvas = this.container.querySelector('#ocr-document-canvas');
        const maxW = canvas ? canvas.clientWidth : 800;
        const maxH = canvas ? canvas.clientHeight : 1000;

        const newX = Math.max(0, Math.min(this.initialCrop.x + dx, maxW - this.initialCrop.width));
        const newY = Math.max(0, Math.min(this.initialCrop.y + dy, maxH - this.initialCrop.height));

        this.displayCrop.x = Math.round(newX);
        this.displayCrop.y = Math.round(newY);
        this._updateCropBoxDOM();
      });

      window.addEventListener('mouseup', () => {
        if (this.isDragging) {
          this.isDragging = false;
        }
      });
    }
  }

  /**
   * Executes OCR on the cropped sub-region.
   * @private
   */
  async _executeOcrPipeline() {
    const canvas = this.container.querySelector('#ocr-document-canvas');
    if (!canvas) return;

    // Map display crop to natural pixels
    const dispDim = { width: canvas.clientWidth, height: canvas.clientHeight };
    ocrService.setCropFromDisplay(this.displayCrop, dispDim);

    // Extract isolated crop canvas
    const croppedCanvas = ocrService.extractCroppedSubCanvas(canvas);

    this.currentStep = 'RECOGNIZING';
    this.ocrProgress = { status: 'Initializing Tesseract Web Worker...', progress: 10 };
    this.render();

    try {
      const candidates = await ocrService.runOcrOnCroppedCanvas(croppedCanvas, {
        onProgress: p => {
          this.ocrProgress = p;
          const fill = this.container.querySelector('.ocr-progress-fill');
          if (fill) fill.style.width = `${p.progress}%`;
        }
      });

      this._setupReviewedCandidates(candidates);
      this.currentStep = 'REVIEW';
      this.render();
    } catch (err) {
      this.ocrError = err.message || "OCR recognition failed.";
      this.currentStep = 'CROP';
      this.render();
      await this._drawDocumentToCanvas();
    }
  }

  /**
   * Sets up candidate rows for review and initializes pseudonymous key mapping.
   * @private
   */
  _setupReviewedCandidates(candidates) {
    const state = stateManager.getState();
    const existingDataset = state.acceptedDataset || [];
    const existingKeys = Array.from(new Set(existingDataset.map(r => r.student_key)));

    this.reviewedCandidates = candidates.map((cand, idx) => {
      // If dataset exists and row matches an existing student key index, pre-select it
      // Otherwise, mark as new student with unique collision-free key
      let assignedKey = null;
      let isNew = false;

      if (existingKeys.length > idx) {
        assignedKey = existingKeys[idx];
        isNew = false;
      } else {
        assignedKey = generateUniqueStudentKey(existingKeys, idx + 1);
        isNew = true;
      }

      return {
        ...cand,
        assignedKey: assignedKey,
        isNewStudent: isNew
      };
    });
  }

  /**
   * Event listeners for Review Stage.
   * @private
   */
  _bindReviewEvents() {
    const targetSemInput = this.container.querySelector('#input-target-semester');
    if (targetSemInput) {
      targetSemInput.addEventListener('change', (e) => {
        this.targetSemester = Number(e.target.value);
      });
    }

    // Editable SGPA inputs
    const sgpaInputs = this.container.querySelectorAll('.candidate-sgpa-input');
    sgpaInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.index);
        this.reviewedCandidates[idx].extractedSgpa = e.target.value.trim();
        this._revalidateCandidateRow(this.reviewedCandidates[idx]);
      });
    });

    // Student Key Selectors
    const keySelects = this.container.querySelectorAll('.candidate-key-select');
    keySelects.forEach(select => {
      select.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.index);
        const val = e.target.value;

        if (val === '__NEW__') {
          this.reviewedCandidates[idx].isNewStudent = true;
          this.reviewedCandidates[idx].assignedKey = generateUniqueStudentKey(
            this.reviewedCandidates.map(c => c.assignedKey),
            idx + 1
          );
        } else {
          this.reviewedCandidates[idx].isNewStudent = false;
          this.reviewedCandidates[idx].assignedKey = val;
        }
        this.render();
      });
    });

    // Custom Key Inputs
    const customKeyInputs = this.container.querySelectorAll('.candidate-custom-key-input');
    customKeyInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.index);
        this.reviewedCandidates[idx].assignedKey = e.target.value.trim();
      });
    });

    // Delete row button
    const deleteBtns = this.container.querySelectorAll('.btn-delete-row');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(btn.dataset.index);
        this.reviewedCandidates.splice(idx, 1);
        this.render();
      });
    });

    // Add manual row button
    const btnAddRow = this.container.querySelector('#btn-add-manual-row');
    if (btnAddRow) {
      btnAddRow.addEventListener('click', () => {
        const state = stateManager.getState();
        const existingKeys = (state.acceptedDataset || []).map(r => r.student_key);
        const newKey = generateUniqueStudentKey(
          [...existingKeys, ...this.reviewedCandidates.map(c => c.assignedKey)],
          this.reviewedCandidates.length + 1
        );

        this.reviewedCandidates.push({
          cropSequence: this.reviewedCandidates.length + 1,
          rawText: '(Manual Entry)',
          extractedSgpa: '3.50',
          proposedFix: null,
          confidence: 100.0,
          status: 'VALID',
          warnings: [],
          assignedKey: newKey,
          isNewStudent: !existingKeys.includes(newKey)
        });
        this.render();
      });
    }

    // Navigation buttons
    const btnBackToCrop = this.container.querySelector('#btn-back-to-crop');
    if (btnBackToCrop) {
      btnBackToCrop.addEventListener('click', async () => {
        this.currentStep = 'CROP';
        this.render();
        await this._drawDocumentToCanvas();
      });
    }

    const btnDiscard = this.container.querySelector('#btn-discard-import');
    if (btnDiscard) {
      btnDiscard.addEventListener('click', () => {
        ocrService.discardTemporaryState();
        this.currentStep = 'UPLOAD';
        this.render();
      });
    }

    // Confirm & Commit button
    const btnConfirm = this.container.querySelector('#btn-confirm-commit');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        this._handleConfirmCommit();
      });
    }
  }

  /**
   * Revalidates an individual candidate row when edited by user.
   * @private
   */
  _revalidateCandidateRow(cand) {
    const val = parseFloat(cand.extractedSgpa);
    cand.warnings = [];

    if (!Number.isFinite(val)) {
      cand.status = 'INVALID';
      cand.warnings.push("Extracted non-finite number.");
    } else if (val < 0.00 || val > DEFAULT_SCALE_MAX) {
      cand.status = 'OUT_OF_SCALE';
      cand.warnings.push(`SGPA ${val.toFixed(2)} is outside scale [0.00, ${DEFAULT_SCALE_MAX.toFixed(2)}].`);
    } else {
      cand.status = 'VALID';
      cand.extractedSgpa = val.toFixed(2);
    }
    this.render();
  }

  /**
   * Executes atomic commitment to StateManager.
   * @private
   */
  _handleConfirmCommit() {
    this.commitErrors = [];
    const state = stateManager.getState();
    const acceptedDataset = state.acceptedDataset || [];

    // Step 1: Reconcile keys & validate candidate rows
    const reconciliation = ocrService.reconcileKeys(
      this.reviewedCandidates,
      acceptedDataset,
      this.targetSemester
    );

    if (!reconciliation.isValid) {
      this.commitErrors = reconciliation.errors;
      this.render();
      return;
    }

    // Step 2: Atomic commitment into StateManager
    const commitResult = stateManager.commitReconciledRecords(reconciliation.reconciledRows);

    if (commitResult.success) {
      // Purge temporary OCR state from memory upon success
      ocrService.discardTemporaryState();
      this.commitSummary = commitResult.summary;
      this.currentStep = 'COMMITTED';
      this.render();
    } else {
      this.commitErrors = commitResult.errors;
      this.render();
    }
  }

  /**
   * Event listeners for Committed Stage.
   * @private
   */
  _bindCommittedEvents() {
    const btnPred = this.container.querySelector('#btn-goto-predictions');
    const btnDataset = this.container.querySelector('#btn-goto-dataset');
    const btnIngest = this.container.querySelector('#btn-ingest-another');

    if (btnPred) {
      btnPred.addEventListener('click', () => {
        const tab = document.getElementById('tab-btn-predictions');
        if (tab) tab.click();
      });
    }

    if (btnDataset) {
      btnDataset.addEventListener('click', () => {
        const tab = document.getElementById('tab-btn-dashboard');
        if (tab) tab.click();
      });
    }

    if (btnIngest) {
      btnIngest.addEventListener('click', () => {
        this._initializeTargetSemester();
        this.currentStep = 'UPLOAD';
        this.render();
      });
    }
  }
}
