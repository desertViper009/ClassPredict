/**
 * @file test_linear_algebra.js
 * @description Unit tests for Gaussian elimination with row partial pivoting, scale-aware tolerance, and error handling.
 * Document Reference: docs/VALIDATION_AND_TESTING.md (TC-NUM-01 to TC-NUM-03)
 */

import { describe, it, assert, assertEqual, assertClose, assertThrows } from './test_runner.js';
import { 
  solveLinearSystem, 
  SingularMatrixError, 
  DimensionMismatchError, 
  NonFiniteValueError 
} from '../js/core/linear_algebra.js';

export function loadLinearAlgebraTests() {
  describe("Phase 4: Gaussian Elimination with Row Partial Pivoting", () => {
    it("should solve a well-conditioned 2x2 system with known solution", () => {
      // 2*x1 + 1*x2 = 5
      // 1*x1 + 3*x2 = 5
      // Solution: x1 = 2, x2 = 1
      const A = [
        [2, 1],
        [1, 3]
      ];
      const b = [5, 5];
      const x = solveLinearSystem(A, b);
      assertEqual(x.length, 2);
      assertClose(x[0], 2.0, 1e-12, "x1 must equal 2.0");
      assertClose(x[1], 1.0, 1e-12, "x2 must equal 1.0");
    });

    it("should solve a system requiring a row swap (zero pivot in A[0][0])", () => {
      // 0*x1 + 2*x2 = 4  --> swap with row 2
      // 3*x1 + 1*x2 = 7
      // Row 2: 3*x1 + 1*x2 = 7; Row 1: 2*x2 = 4 => x2 = 2, 3*x1 + 2 = 7 => x1 = 5/3 = 1.6666...
      const A = [
        [0, 2],
        [3, 1]
      ];
      const b = [4, 7];
      const x = solveLinearSystem(A, b);
      assertClose(x[0], 5 / 3, 1e-12, "x1 must equal 5/3");
      assertClose(x[1], 2.0, 1e-12, "x2 must equal 2.0");
    });

    it("should solve a 3x3 system accurately with partial pivoting", () => {
      // x + 2y + 3z = 14
      // 2x + 5y + 2z = 18
      // 3x + y + 5z = 20
      // Solution: x = 1, y = 2, z = 3
      const A = [
        [1, 2, 3],
        [2, 5, 2],
        [3, 1, 5]
      ];
      const b = [14, 18, 20];
      const x = solveLinearSystem(A, b);
      assertClose(x[0], 1.0, 1e-12, "x must equal 1.0");
      assertClose(x[1], 2.0, 1e-12, "y must equal 2.0");
      assertClose(x[2], 3.0, 1e-12, "z must equal 3.0");
    });

    it("should solve a uniformly scaled system with scale invariance", () => {
      // Multiply entire system by 1e-4:
      // 0.0002*x1 + 0.0001*x2 = 0.0005
      // 0.0001*x1 + 0.0003*x2 = 0.0005
      // Mathematical solution is still x1 = 2, x2 = 1
      const A = [
        [0.0002, 0.0001],
        [0.0001, 0.0003]
      ];
      const b = [0.0005, 0.0005];
      const x = solveLinearSystem(A, b);
      assertClose(x[0], 2.0, 1e-10, "Scaled system x1 must equal 2.0");
      assertClose(x[1], 1.0, 1e-10, "Scaled system x2 must equal 1.0");
    });

    it("should guarantee input immutability by not modifying caller arrays", () => {
      const A = [
        [4, 2],
        [1, 3]
      ];
      const b = [8, 7];
      const origA00 = A[0][0], origA10 = A[1][0];
      const origB0 = b[0], origB1 = b[1];

      solveLinearSystem(A, b);

      assertEqual(A[0][0], origA00, "A[0][0] must not be mutated");
      assertEqual(A[1][0], origA10, "A[1][0] must not be mutated");
      assertEqual(b[0], origB0, "b[0] must not be mutated");
      assertEqual(b[1], origB1, "b[1] must not be mutated");
    });
  });

  describe("Phase 4: Linear Algebra Error Handling & Singular Systems", () => {
    it("should throw SingularMatrixError on exactly singular systems (collinear rows)", () => {
      // Row 2 is 2 * Row 1
      const A = [
        [2, 4],
        [1, 2]
      ];
      const b = [8, 4];
      assertThrows(() => solveLinearSystem(A, b), SingularMatrixError, "Collinear matrix must throw SingularMatrixError");
    });

    it("should throw SingularMatrixError on an all-zero matrix", () => {
      const A = [
        [0, 0],
        [0, 0]
      ];
      const b = [0, 0];
      assertThrows(() => solveLinearSystem(A, b), SingularMatrixError, "All-zero matrix must throw SingularMatrixError");
    });

    it("should throw SingularMatrixError on a nearly-singular system violating scale tolerance", () => {
      const A = [
        [1.0, 1.0],
        [1.0, 1.0 + 1e-15] // Differs by less than relative tolerance * scale
      ];
      const b = [2.0, 2.0];
      assertThrows(() => solveLinearSystem(A, b), SingularMatrixError, "Near-singular system must throw SingularMatrixError");
    });

    it("should throw DimensionMismatchError on non-square matrices or length mismatches", () => {
      const A_nonSquare = [
        [1, 2, 3],
        [4, 5, 6]
      ];
      const b2 = [1, 2];
      assertThrows(() => solveLinearSystem(A_nonSquare, b2), DimensionMismatchError, "Non-square A must throw");

      const A_square = [
        [1, 2],
        [3, 4]
      ];
      const b_wrong = [1, 2, 3];
      assertThrows(() => solveLinearSystem(A_square, b_wrong), DimensionMismatchError, "Mismatched b length must throw");
    });

    it("should throw NonFiniteValueError when inputs contain NaN or Infinity", () => {
      const A_nan = [
        [1, NaN],
        [3, 4]
      ];
      const b = [1, 2];
      assertThrows(() => solveLinearSystem(A_nan, b), NonFiniteValueError, "NaN in A must throw NonFiniteValueError");

      const A_valid = [
        [1, 2],
        [3, 4]
      ];
      const b_inf = [1, Infinity];
      assertThrows(() => solveLinearSystem(A_valid, b_inf), NonFiniteValueError, "Infinity in b must throw NonFiniteValueError");
    });
  });
}
