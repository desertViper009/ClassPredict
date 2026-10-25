import { describe, it, assert, assertEqual, assertFalse } from './test_runner.js';

export function loadUiContractTests() {
  describe('Premium UI: Shared Preview Contract', () => {
    it('exposes every required preview workspace as explicitly synthetic data', async () => {
      const { getPreviewModel } = await import('../js/design_preview.js');
      const model = getPreviewModel();

      assertEqual(model.productName, 'ClassPredict');
      assertEqual(model.isSynthetic, true, 'Preview data must be explicitly labelled synthetic');
      assertEqual(model.sections.length, 6, 'Preview must include all six required workspaces');
      assertEqual(
        model.sections.map(section => section.id).join(','),
        'overview,dataset,individual,class,ocr,lab'
      );
      assert(model.sections.every(section => section.label && section.description));
      assertFalse(
        JSON.stringify(model).toLowerCase().includes('hero_model'),
        'Preview model must not reference editorial photography'
      );
    });
  });

  describe('Premium UI: Application Shell Contract', () => {
    it('maps one navigation item to each real workspace and separates prediction modes', async () => {
      const { getNavigationModel, navigateTo } = await import('../js/app.js');
      const items = getNavigationModel();
      const ids = items.map(item => item.id);

      assertEqual(new Set(ids).size, ids.length, 'Navigation IDs must be unique');
      assertEqual(ids.join(','), 'dashboard,dataset,individual,class,ocr,lab');
      assertEqual(items.find(item => item.id === 'individual').tab, 'predictions');
      assertEqual(items.find(item => item.id === 'individual').predictionMode, 'individual');
      assertEqual(items.find(item => item.id === 'class').predictionMode, 'class');
      assertEqual(typeof navigateTo, 'function', 'Shell must expose one navigation entry point');
    });
  });
  describe('Premium UI: Dashboard Contract', () => {
    it('excludes editorial assets, star ratings, and hardcoded claims from dashboard', async () => {
      const { DashboardView } = await import('../js/ui/dashboard_view.js');
      const { stateManager } = await import('../js/services/state_manager.js');

      stateManager.clearAcceptedDataset();
      const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      const view = new DashboardView(mockContainer);
      view.render();

      const html = mockContainer.innerHTML;
      assert(html.includes('CSE NUMERICAL METHODS PROJECT'), 'Dashboard must display academic capstone context');
      assert(html.includes('ClassPredict'), 'Dashboard must include product title');
      assertFalse(html.includes('hero_model.jpg'), 'Must not reference editorial photo hero_model.jpg');
      assertFalse(html.includes('hero_thumb.jpg'), 'Must not reference editorial thumbnail hero_thumb.jpg');
      assertFalse(html.includes('★★★★★'), 'Must not display fabricated star ratings');
      assertFalse(html.includes('0.082'), 'Must not display hardcoded unsupported MAE');
      assertFalse(html.includes('Happy Clients'), 'Must not include marketing client claims');
    });

    it('renders real computed KPIs, 4-panel analytical overview, and prediction preview when dataset is loaded', async () => {
      const { DashboardView } = await import('../js/ui/dashboard_view.js');
      const { stateManager } = await import('../js/services/state_manager.js');

      const sampleCsv = "student_key,semester_no,sgpa\nSTU_001,1,3.20\nSTU_001,2,3.40\nSTU_002,1,2.80\nSTU_002,2,3.00\nSTU_003,1,3.50\nSTU_003,2,3.65";

      stateManager.clearAcceptedDataset();
      stateManager.loadCSV(sampleCsv);
      stateManager.acceptStagedDataset();

      const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      const view = new DashboardView(mockContainer);
      view.render();

      const html = mockContainer.innerHTML;
      // 4 KPIs
      assert(html.includes('Unique Students'), 'Must render Unique Students KPI');
      assert(html.includes('Accepted Records'), 'Must render Accepted Records KPI');
      assert(html.includes('Valid Transitions'), 'Must render Valid Transitions KPI');
      assert(html.includes('Shared Model'), 'Must render Shared Model KPI');
      assert(html.includes('>3<') || html.includes('3 Students') || html.includes('3<'), 'Must reflect computed 3 unique students');
      assert(html.includes('>6<') || html.includes('6 Records') || html.includes('6<'), 'Must reflect computed 6 total records');

      // 4-panel analytical overview
      assert(html.includes('Semester SGPA Distribution'), 'Must include Semester SGPA Distribution panel');
      assert(html.includes('Historical vs Predicted SGPA') || html.includes('Historical vs. Predicted'), 'Must include Historical vs Predicted transition panel');
      assert(html.includes('Next-Semester Prediction Preview'), 'Must include Next-Semester Prediction Preview panel');
      assert(html.includes('Model Performance (Temporal Validation)') || html.includes('Temporal Validation'), 'Must include Temporal Validation panel');
      assert(html.includes('STU_001'), 'Prediction preview must list actual student keys');
      assertFalse(html.includes('hero_model.jpg'), 'Must not reference editorial photo in active state');

      stateManager.clearAcceptedDataset();
    });
  });

  describe('Premium UI: Dataset Workflow Contract', () => {
    it('renders accessible import zone, schema guidance, and safe discard actions', async () => {
      const { DatasetView } = await import('../js/ui/dataset_view.js');
      const { stateManager } = await import('../js/services/state_manager.js');

      stateManager.clearAcceptedDataset();
      const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      const view = new DatasetView(mockContainer);
      view.render();

      let html = mockContainer.innerHTML;
      assert(html.includes('student_key,semester_no,sgpa'), 'Must specify exact permitted 3-column CSV schema');
      assert(html.includes('id="csv-dropzone"') || html.includes('cp-dropzone'), 'Must render CSV upload dropzone');
      assert(html.includes('id="btn-load-sample"'), 'Must provide synthetic sample loader button');

      // Test with accepted dataset
      const sampleCsv = "student_key,semester_no,sgpa\nSTU_001,1,3.20\nSTU_001,2,3.40";
      stateManager.loadCSV(sampleCsv);
      stateManager.acceptStagedDataset();
      view.render();

      html = mockContainer.innerHTML;
      assert(html.includes('id="btn-clear-accepted"'), 'Must provide explicit discard action for active dataset');
      assert(html.includes('cp-table-scroll') || html.includes('table-wrapper'), 'Must contain table in scrollable wrapper');
      assert(html.includes('STU_001'), 'Must render accepted records in preview table');

      stateManager.clearAcceptedDataset();
    });
  });

  describe('Premium UI: Prediction Workflows Contract', () => {
    it('supports distinct individual and whole-class workspaces with responsive tables and export', async () => {
      const { PredictionView } = await import('../js/ui/prediction_view.js');
      const { stateManager } = await import('../js/services/state_manager.js');

      const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      const view = new PredictionView(mockContainer);

      // Individual mode
      view.activeSubtab = 'individual';
      view.render();
      let html = mockContainer.innerHTML;
      assert(html.includes('Individual'), 'Must render individual prediction workspace');
      assert(html.includes('id="btn-calculate-individual"') || html.includes('id="btn-calc-individual"'), 'Must have forecast calculation button');
      assert(html.includes('id="btn-add-observation"'), 'Must allow adding observation up to 7 semesters');

      // Whole-class mode
      const sampleCsv = "student_key,semester_no,sgpa\nSTU_001,1,3.20\nSTU_001,2,3.40\nSTU_002,1,2.80\nSTU_002,2,3.00";
      stateManager.clearAcceptedDataset();
      stateManager.loadCSV(sampleCsv);
      stateManager.acceptStagedDataset();

      view.activeSubtab = 'wholeClass';
      view.updateWholeClassPredictions();
      view.render();
      html = mockContainer.innerHTML;

      assert(html.includes('Whole-Class') || html.includes('Whole Class'), 'Must render whole-class workspace');
      assert(html.includes('cp-table-scroll') || html.includes('table-wrapper'), 'Must contain whole-class table in scroll-contained container');
      assert(html.includes('id="input-class-search"'), 'Must provide student key search filter');
      assert(html.includes('id="btn-export-class-csv"') || html.includes('id="btn-export-class"'), 'Must provide whole-class CSV export button');
      assert(html.includes('STU_001'), 'Whole-class table must list student STU_001');

      stateManager.clearAcceptedDataset();
    });
  });

  describe('Premium UI: Seven-Stage OCR Review Contract', () => {
    it('displays visible seven-stage stepper, accurate network copy, and safety barrier', async () => {
      const { OCRView } = await import('../js/ui/ocr_view.js');

      const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      const view = new OCRView(mockContainer);
      view.render();

      const html = mockContainer.innerHTML;
      assert(html.includes('cp-stepper'), 'Must render seven-stage stepper with cp-stepper class');
      assert(html.includes('Upload'), 'Must include step 1: Upload');
      assert(html.includes('Page'), 'Must include step 2: Page');
      assert(html.includes('Crop'), 'Must include step 3: Crop');
      assert(html.includes('Extract'), 'Must include step 4: Extract');
      assert(html.includes('Review'), 'Must include step 5: Review');
      assert(html.includes('Keys'), 'Must include step 6: Keys');
      assert(html.includes('Confirm'), 'Must include step 7: Confirm');
      assert(html.includes('network access'), 'Must accurately describe that library assets may require network access');
      assert(html.includes('Safety') || html.includes('Barrier') || html.includes('commitment'), 'Must state safety barrier condition before dataset commitment');
    });
  });

  describe('Premium UI: Numerical Methods Lab Contract', () => {
    it('covers all five educational experiments with accessible navigation and numerical traces', async () => {
      const { NumericalLabView } = await import('../js/ui/numerical_lab_view.js');

      const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      const view = new NumericalLabView(mockContainer);

      // Experiment A: Gaussian
      view.activeSubTab = 'exp-a';
      view.render();
      let html = mockContainer.innerHTML;
      assert(html.includes('Gaussian') || html.includes('Elimination'), 'Must render Gaussian experiment');
      assert(html.includes('id="btn-gauss-next"') || html.includes('id="gauss-btn-next"') || html.includes('data-step="next"'), 'Must have Gaussian forward step control');
      assert(html.includes('matrix') || html.includes('Matrix'), 'Must render augmented matrix');

      // Experiment B: Regression Comparison
      view.activeSubTab = 'exp-b';
      view.runRegressionExperiment();
      view.render();
      html = mockContainer.innerHTML;
      assert(html.includes('Linear') && html.includes('Quadratic'), 'Must render Linear vs Quadratic regression comparison');

      // Experiment C: Newton Divided Differences
      view.activeSubTab = 'exp-c';
      view.runInterpolationExperiment();
      view.render();
      html = mockContainer.innerHTML;
      assert(html.includes('Newton') || html.includes('Divided Differences'), 'Must render Newton interpolation');

      // Experiment D: Runge Phenomenon
      view.activeSubTab = 'exp-d';
      view.runRungeDemo();
      view.render();
      html = mockContainer.innerHTML;
      assert(html.includes('Runge'), 'Must render Runge phenomenon experiment');

      // Topics: Stability Topics
      view.activeSubTab = 'topics';
      view.render();
      html = mockContainer.innerHTML;
      assert(html.includes('Stability') || html.includes('Conditioning'), 'Must render stability topics');
    });
  });
}




