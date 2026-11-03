import type { Point } from './types'

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

export function pathLength(pts: Point[]): number {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i])
  return total
}

export function bounds(pts: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/** Lấy mẫu lại thành n điểm cách đều theo độ dài cung (bước đầu của $1 Recognizer). */
export function resample(points: Point[], n: number): Point[] {
  const total = pathLength(points)
  if (total === 0) return points.slice()
  const interval = total / (n - 1)
  const src = points.slice()
  const out: Point[] = [src[0]]
  let acc = 0
  for (let i = 1; i < src.length; i++) {
    const d = dist(src[i - 1], src[i])
    if (d > 0 && acc + d >= interval) {
      const t = (interval - acc) / d
      const q = { x: src[i - 1].x + t * (src[i].x - src[i - 1].x), y: src[i - 1].y + t * (src[i].y - src[i - 1].y) }
      out.push(q)
      src.splice(i, 0, q)
      acc = 0
    } else {
      acc += d
    }
  }
  while (out.length < n) out.push(src[src.length - 1])
  return out.slice(0, n)
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Góc trong (độ) tại đỉnh b của a-b-c. 180 = thẳng hàng. */
export function interiorAngle(a: Point, b: Point, c: Point): number {
  const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y
  const m = Math.hypot(ux, uy) * Math.hypot(vx, vy)
  if (m === 0) return 180
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / m))
  return (Math.acos(cos) * 180) / Math.PI
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const deg = (rad: number) => (rad * 180) / Math.PI

/** Khoảng cách giữa hai chỉ số trên vòng có n phần tử. */
export const circDist = (i: number, j: number, n: number) => {
  const d = Math.abs(i - j)
  return Math.min(d, n - d)
}

/** Giao điểm của hai đường thẳng (điểm + hướng). Trả về null nếu gần song song. */
export function intersectLines(p: Point, d: Point, q: Point, e: Point): Point | null {
  const det = d.x * e.y - d.y * e.x
  if (Math.abs(det) < 1e-9) return null
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / det
  return { x: p.x + t * d.x, y: p.y + t * d.y }
}

/** Đường thẳng khớp nhất (bình phương tối thiểu toàn phần): trả về tâm và vector hướng đơn vị. */
export function fitLine(pts: Point[]): { c: Point; d: Point } {
  const n = pts.length
  const cx = pts.reduce((s, p) => s + p.x, 0) / n
  const cy = pts.reduce((s, p) => s + p.y, 0) / n
  let sxx = 0, syy = 0, sxy = 0
  for (const p of pts) { sxx += (p.x - cx) ** 2; syy += (p.y - cy) ** 2; sxy += (p.x - cx) * (p.y - cy) }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  return { c: { x: cx, y: cy }, d: { x: Math.cos(th), y: Math.sin(th) } }
}
