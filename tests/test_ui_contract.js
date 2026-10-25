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
}
