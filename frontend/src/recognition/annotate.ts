import type { Fit, Point } from './types'
import { clamp, dist, interiorAngle } from './geometry'

const LETTERS = 'ABCDEFGHIJKL'

/** Các đỉnh của hình đa giác hoặc chữ nhật (chữ nhật được dựng từ tâm, kích thước và góc xoay). */
export function cornersOf(fit: Fit): Point[] | null {
  if (fit.kind === 'polygon') return fit.vertices
  if (fit.kind === 'rectangle') {
    const c = Math.cos(fit.rotation), s = Math.sin(fit.rotation)
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({
      x: fit.center.x + ((a * fit.w) / 2) * c - ((b * fit.h) / 2) * s,
      y: fit.center.y + ((a * fit.w) / 2) * s + ((b * fit.h) / 2) * c,
    }))
  }
  return null
}

/**
 * Sắp xếp đỉnh theo quy ước sách giáo khoa: A là đỉnh cao nhất (nếu có nhiều đỉnh ngang nhau thì lấy bên trái),
 * rồi đi ngược chiều kim đồng hồ trên màn hình (A trên, B dưới trái, C dưới phải).
 */
export function orderVertices(v: Point[]): Point[] {
  let area = 0
  for (let i = 0; i < v.length; i++) {
    const p = v[i], q = v[(i + 1) % v.length]
    area += p.x * q.y - q.x * p.y
  }
  const pts = area > 0 ? [...v].reverse() : [...v] // trục y hướng xuống: diện tích dương = thuận chiều kim đồng hồ
  let start = 0
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].y < pts[start].y - 1e-6 || (Math.abs(pts[i].y - pts[start].y) <= 1e-6 && pts[i].x < pts[start].x)) start = i
  }
  return [...pts.slice(start), ...pts.slice(0, start)]
}

export interface Annotation {
  /** Nhãn đỉnh và vị trí tâm của nhãn (ngoài hình). */
  labels: { text: string; at: Point }[]
  /** Mỗi ký hiệu góc vuông là một đường 3 điểm (hình vuông nhỏ ở góc). */
  rightAngles: Point[][]
}

export function annotate(vertices: Point[], opts: { labels: boolean; rightAngles: boolean }): Annotation {
  const out: Annotation = { labels: [], rightAngles: [] }
  const n = vertices.length
  if (n < 3 || n > LETTERS.length) return out
  const v = orderVertices(vertices)
  const cen = { x: v.reduce((s, p) => s + p.x, 0) / n, y: v.reduce((s, p) => s + p.y, 0) / n }
  const diag = Math.hypot(Math.max(...v.map((p) => p.x)) - Math.min(...v.map((p) => p.x)), Math.max(...v.map((p) => p.y)) - Math.min(...v.map((p) => p.y)))

  for (let i = 0; i < n; i++) {
    const p = v[i], prev = v[(i - 1 + n) % n], next = v[(i + 1) % n]
    const u = unit(prev, p), w = unit(next, p)

    if (opts.labels) {
      // Hướng ra ngoài = ngược với phân giác trong; nếu suy biến thì đi từ trọng tâm ra
      let dx = -(u.x + w.x), dy = -(u.y + w.y)
      if (Math.hypot(dx, dy) < 1e-6) { dx = p.x - cen.x; dy = p.y - cen.y }
      const m = Math.hypot(dx, dy) || 1
      const d = clamp(0.09 * diag, 16, 30)
      out.labels.push({ text: LETTERS[i], at: { x: p.x + (dx / m) * d, y: p.y + (dy / m) * d } })
    }

    if (opts.rightAngles && Math.abs(interiorAngle(prev, p, next) - 90) <= 8) {
      const s = clamp(0.12 * Math.min(dist(prev, p), dist(next, p)), 6, 20)
      const a = { x: p.x + u.x * s, y: p.y + u.y * s }
      const b = { x: a.x + w.x * s, y: a.y + w.y * s }
      const c = { x: p.x + w.x * s, y: p.y + w.y * s }
      out.rightAngles.push([a, b, c])
    }
  }
  return out
}

/** Vector đơn vị từ `from` hướng tới `to`... dùng làm hướng từ đỉnh đi tới điểm kề. */
function unit(to: Point, from: Point): Point {
  const d = Math.hypot(to.x - from.x, to.y - from.y) || 1
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d }
}
