/**
 * @file test_foundation.js
 * @description Foundation unit tests verifying mathematical accuracy, centering, scale-aware metrics, and variance checks.
 */

import { describe, it, assert, assertEqual, assertClose, assertThrows } from './test_runner.js';
import {
  mean,
  variance,
  hasNearZeroVariance,
  center,
  dot,
  getSubmatrixScale,
  transpose,
  det2x2WithScale,
  isAllFinite
} from '../js/core/math_utils.js';

export function loadFoundationTests() {
  describe("Statistical & Array Utilities", () => {
    it("should accurately compute the arithmetic mean", () => {
      const data = [3.20, 3.40, 3.60, 3.80];
      const m = mean(data);
      assertClose(m, 3.50, 1e-12, "Mean of [3.2, 3.4, 3.6, 3.8] must equal 3.50");
    });

    it("should compute sample variance accurately", () => {
      const data = [1.0, 2.0, 3.0, 4.0, 5.0];
      // Mean = 3.0, deviations: [-2, -1, 0, 1, 2], squared: [4, 1, 0, 1, 4], sum = 10, var = 10 / 5 = 2.0
      const v = variance(data);
      assertClose(v, 2.0, 1e-12, "Sample variance must equal 2.0");
    });

    it("should detect near-zero variance on degenerate data (Singularity Pre-Check)", () => {
      const identicalGrades = [3.50, 3.50, 3.50, 3.50, 3.50];
      const isDegenerate = hasNearZeroVariance(identicalGrades);
      assert(isDegenerate === true, "Identical array must be detected as having near-zero variance");

      const varyingGrades = [3.20, 3.50, 3.80];
      assert(hasNearZeroVariance(varyingGrades) === false, "Varying array must not trigger near-zero variance");
    });

    it("should center predictors such that the sum of centered values is zero within machine precision", () => {
      const x = [2.50, 3.10, 3.45, 3.75, 4.00];
      const { centered, mean: m } = center(x);
      assertClose(m, 3.36, 1e-12);
      
      const sumCentered = centered.reduce((acc, val) => acc + val, 0);
      assertClose(sumCentered, 0.0, 1e-14, "Sum of centered predictors must be zero within machine precision");
    });
  });

  describe("Linear Algebra & Vector Operations", () => {
    it("should compute vector dot products accurately", () => {
      const u = [1.0, 2.0, 3.0];
      const v = [4.0, 5.0, 6.0];
      const res = dot(u, v); // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      assertClose(res, 32.0, 1e-12);
    });

    it("should throw an error when dot product receives mismatched dimensions", () => {
      const u = [1.0, 2.0];
      const v = [1.0, 2.0, 3.0];
      assertThrows(() => dot(u, v), Error, "Dot product on mismatched vector lengths must throw");
    });

    it("should correctly transpose a non-square 2D matrix", () => {
      const A = [
        [1, 2, 3],
        [4, 5, 6]
      ]; // 2x3 matrix
      const AT = transpose(A); // 3x2 matrix
      assertEqual(AT.length, 3);
      assertEqual(AT[0].length, 2);
      assertEqual(AT[0][0], 1);
      assertEqual(AT[0][1], 4);
      assertEqual(AT[2][0], 3);
      assertEqual(AT[2][1], 6);
    });
  });

  describe("Numerical Conditioning & Scale-Aware Metrics", () => {
    it("should correctly extract the maximum absolute scale of a submatrix", () => {
      const A = [
        [2.0, -1.0, 0.5],
        [0.0, 8.5, -12.0],
        [1.0, 3.0, 4.0]
      ];
      // Full matrix scale
      assertEqual(getSubmatrixScale(A, 0), 12.0);
      // Submatrix scale starting from row 1, col 1: [8.5, -12.0], [3.0, 4.0]
      assertEqual(getSubmatrixScale(A, 1), 12.0);
      // Submatrix scale starting from row 2, col 2: [4.0]
      assertEqual(getSubmatrixScale(A, 2), 4.0);
    });

    it("should demonstrate scale-dependence of 2x2 determinants and scale invariance of normalized determinant", () => {
      const A = [
        [2.0, 1.0],
        [1.0, 3.0]
      ];
      // det(A) = 2*3 - 1*1 = 5. Scale = 3. Normalized det = 5 / 9 = 0.5555...
      const resA = det2x2WithScale(A);
      assertClose(resA.det, 5.0, 1e-12);
      assertClose(resA.scale, 3.0, 1e-12);
      assertClose(resA.normalizedDet, 5.0 / 9.0, 1e-12);

      // Scaled by c = 0.01:
      const B = [
        [0.02, 0.01],
        [0.01, 0.03]
      ];
      // det(B) = c^2 * det(A) = 0.0001 * 5 = 0.0005. Notice det < 1e-3, but matrix is perfectly well-conditioned!
      const resB = det2x2WithScale(B);
      assertClose(resB.det, 0.0005, 1e-12);
      assertClose(resB.scale, 0.03, 1e-12);
      // Normalized determinant is scale-invariant!
      assertClose(resB.normalizedDet, 5.0 / 9.0, 1e-12, "Normalized determinant must remain scale-invariant");
    });

    it("should detect non-finite elements (NaN / Infinity)", () => {
      assert(isAllFinite([1.0, 2.5, 3.8]) === true);
      assert(isAllFinite([1.0, NaN, 3.8]) === false);
      assert(isAllFinite([1.0, Infinity, 3.8]) === false);
      assert(isAllFinite([-Infinity]) === false);
    });
  });
}
