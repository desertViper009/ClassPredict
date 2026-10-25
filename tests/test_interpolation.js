/**
 * @file test_interpolation.js
 * @description Unit tests for Newton divided-difference polynomial interpolation and evaluation.
 * Document Reference: docs/VALIDATION_AND_TESTING.md (TC-NUM-06)
 */

import { describe, it, assert, assertEqual, assertClose, assertThrows } from './test_runner.js';
import { 
  computeDividedDifferences, 
  evaluateNewtonPolynomial, 
  fitNewtonInterpolation 
} from '../js/core/interpolation_engine.js';

export function loadInterpolationTests() {
  describe("Phase 4: Newton Divided-Difference Interpolation", () => {
    it("should compute divided-difference coefficients accurately for known points", () => {
      // Known quadratic data:
      // x = [1, 2, 4], y = [1, 3, 13]
      // f[x0] = 1
      // f[x0, x1] = (3 - 1)/(2 - 1) = 2
      // f[x1, x2] = (13 - 3)/(4 - 2) = 5
      // f[x0, x1, x2] = (5 - 2)/(4 - 1) = 1
      // Coefficients: c0 = 1, c1 = 2, c2 = 1
      // Polynomial: P(x) = 1 + 2*(x - 1) + 1*(x - 1)*(x - 2)
      // Check: P(1) = 1, P(2) = 3, P(4) = 1 + 2*3 + 1*3*2 = 1 + 6 + 6 = 13.
      const x = [1, 2, 4];
      const y = [1, 3, 13];
      const res = computeDividedDifferences(x, y);

      assertClose(res.coefficients[0], 1.0, 1e-12);
      assertClose(res.coefficients[1], 2.0, 1e-12);
      assertClose(res.coefficients[2], 1.0, 1e-12);
    });

    it("should reproduce all known data points exactly (P_n(x_i) = y_i)", () => {
      // Academic semester history:
      // Semesters: 1, 2, 3, 4
      // SGPAs: 3.10, 3.25, 3.40, 3.65
      const x = [1, 2, 3, 4];
      const y = [3.10, 3.25, 3.40, 3.65];
      const model = fitNewtonInterpolation(x, y);

      for (let i = 0; i < x.length; i++) {
        const evalRes = model.evaluate(x[i]);
        assertClose(evalRes.value, y[i], 1e-12, `Polynomial must reproduce point (${x[i]}, ${y[i]})`);
        assertEqual(evalRes.isExtrapolation, false, "Interior node is not extrapolation");
      }
    });

    it("should evaluate polynomial at interior points smoothly", () => {
      const x = [1, 2, 4];
      const y = [1, 3, 13]; // P(x) = x^2 - x + 1
      const model = fitNewtonInterpolation(x, y);

      // Evaluate at x = 3: P(3) = 3^2 - 3 + 1 = 7
      const evalRes = model.evaluate(3);
      assertClose(evalRes.value, 7.0, 1e-12, "P(3) must equal 7.0");
      assertEqual(evalRes.isExtrapolation, false);
    });

    it("should detect when evaluation point is outside domain (extrapolation)", () => {
      const x = [1, 2, 3];
      const y = [3.0, 3.2, 3.5];
      const model = fitNewtonInterpolation(x, y);

      // Evaluating beyond semester 3:
      const evalFuture = model.evaluate(4);
      assertEqual(evalFuture.isExtrapolation, true, "x = 4 must be flagged as extrapolation");

      // Evaluating before semester 1:
      const evalPast = model.evaluate(0);
      assertEqual(evalPast.isExtrapolation, true, "x = 0 must be flagged as extrapolation");
    });

    it("should reject duplicate x nodes to prevent division by zero in divided differences", () => {
      const x_dup = [1, 2, 2, 4];
      const y = [3.0, 3.2, 3.4, 3.8];
      assertThrows(
        () => computeDividedDifferences(x_dup, y),
        Error,
        "Duplicate x node must throw error"
      );
    });

    it("should throw an error on dimension mismatch or empty inputs", () => {
      assertThrows(() => computeDividedDifferences([], []), Error, "Empty arrays must throw");
      assertThrows(() => computeDividedDifferences([1, 2], [3]), Error, "Length mismatch must throw");
    });

    it("should throw an error on non-finite node coordinates", () => {
      assertThrows(() => computeDividedDifferences([1, NaN], [2, 3]), Error, "NaN in x must throw");
      assertThrows(() => computeDividedDifferences([1, 2], [Infinity, 3]), Error, "Infinity in y must throw");
    });

    it("should guarantee input immutability by not modifying caller arrays", () => {
      const x = [1, 2, 3];
      const y = [3.0, 3.2, 3.5];
      const xStr = JSON.stringify(x);
      const yStr = JSON.stringify(y);

      computeDividedDifferences(x, y);

      assertEqual(JSON.stringify(x), xStr, "x must not be mutated");
      assertEqual(JSON.stringify(y), yStr, "y must not be mutated");
    });
  });
}
