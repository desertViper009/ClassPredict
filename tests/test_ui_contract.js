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
}
