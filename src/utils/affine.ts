import type { Point } from '../types/render'

export type Affine6 = readonly [number, number, number, number, number, number]

/**
 * Affine map (Canvas `setTransform` convention):
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 * Maps source triangle (s0,s1,s2) onto destination triangle (d0,d1,d2).
 */
export function affineFromTriangles(
  s0: Point,
  s1: Point,
  s2: Point,
  d0: Point,
  d1: Point,
  d2: Point,
): Affine6 {
  const A: number[][] = [
    [s0.x, s0.y, 1, 0, 0, 0],
    [0, 0, 0, s0.x, s0.y, 1],
    [s1.x, s1.y, 1, 0, 0, 0],
    [0, 0, 0, s1.x, s1.y, 1],
    [s2.x, s2.y, 1, 0, 0, 0],
    [0, 0, 0, s2.x, s2.y, 1],
  ]
  const b = [d0.x, d0.y, d1.x, d1.y, d2.x, d2.y]
  const x = solveLinearSystem6(A, b)
  return [x[0], x[1], x[2], x[3], x[4], x[5]] as const
}

function solveLinearSystem6(A: number[][], b: number[]): number[] {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])

  for (let i = 0; i < n; i++) {
    let piv = i
    for (let r = i; r < n; r++) {
      if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r
    }
    if (Math.abs(M[piv][i]) < 1e-12) {
      throw new Error('Degenerate triangle mapping')
    }
    ;[M[i], M[piv]] = [M[piv], M[i]]

    const d = M[i][i]
    for (let c = i; c <= n; c++) M[i][c] /= d

    for (let r = 0; r < n; r++) {
      if (r === i) continue
      const f = M[r][i]
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]
    }
  }

  return M.map((row) => row[n])
}
