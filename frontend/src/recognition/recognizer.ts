import type { Point, Recognition } from './types'
import { bounds, circDist, clamp, deg, dist, distToSegment, fitLine, interiorAngle, intersectLines, pathLength, resample } from './geometry'

/**
 * Nhận diện nét vẽ tay thành hình cơ bản. Chạy hoàn toàn trên trình duyệt, không phụ thuộc tldraw.
 * Quy trình: lấy mẫu lại (kiểu $1) -> kiểm tra độ thẳng và độ khép kín -> đếm góc nhọn bằng góc rẽ
 * -> nếu không có góc thì kiểm tra độ tròn (so với elip bao), nếu có 3-8 góc thì dựng lại đa giác
 * bằng cách giao các cạnh đã khớp thẳng (đỉnh sắc nét dù nét vẽ bị bo góc).
 * Các ngưỡng gom ở đây để chỉnh theo nét vẽ thực tế.
 */
export const TUNING = {
  samples: 96,
  minLength: 40,          // nét ngắn hơn (đơn vị trang) thì bỏ qua
  minDiag: 24,
  lineStraightness: 0.93, // chord / chiều dài nét
  closedGap: 0.2,         // khoảng hở đầu-cuối / chiều dài nét
  cornerWindow: 4,        // số mẫu mỗi bên khi đo góc rẽ
  cornerMinTurn: 30,      // góc rẽ (độ) tối thiểu để coi là một góc
  cornerMedianK: 2.5,     // ...và phải lớn hơn mức này lần góc rẽ trung vị (tránh nhầm vòng tròn lượn sóng)
  cornerMargin: 6,        // bỏ bao nhiêu mẫu sát góc khi khớp đường thẳng cho từng cạnh
  mergeAngle: 155,        // đỉnh có góc trong lớn hơn mức này coi là thẳng, bỏ đi
  mergeDist: 0.1,         // đỉnh gần nhau hơn mức này (theo đường chéo) thì gộp
  ellipseMaxE: 0.12,      // sai lệch bán kính chuẩn hoá tối đa để chấp nhận là elip
  maxCorners: 8,
  lineSmooth: 5,          // cửa sổ trung bình trượt trước khi tính độ thẳng: rung tay/ngón tay không biến đường thẳng thành nét cong
  ellipseBeatsPolygonE: 0.075,   // elip khớp tốt hơn mức này...
  ellipseBeatsPolygonErr: 0.02,  // ...và đa giác khớp tệ hơn mức này (theo đường chéo) thì chọn elip
  circleRatio: 0.12,      // a và b chênh dưới mức này thì là hình tròn
  axisSnapDeg: 10,        // lệch trục dưới mức này thì coi là thẳng trục
}

/** Dưới mức tin cậy này thì giao diện giữ nguyên nét vẽ (dùng chung cho hook làm đẹp và bài kiểm thử). */
export const MIN_SNAP_CONFIDENCE = 0.6

const none = (confidence = 0): Recognition => ({ kind: 'unknown', confidence, fit: { kind: 'none' } })

export function recognizeStroke(raw: Point[]): Recognition {
  const clean = raw.filter((p, i) => i === 0 || dist(p, raw[i - 1]) > 0.5)
  if (clean.length < 4 || pathLength(clean) < TUNING.minLength) return none()

  const pts = resample(clean, TUNING.samples)
  const len = pathLength(pts)
  const box = bounds(pts)
  const diag = Math.hypot(box.w, box.h)
  if (diag < TUNING.minDiag || len === 0) return none()

  const gap = dist(pts[0], pts[pts.length - 1])
  return gap / len < TUNING.closedGap ? recognizeClosed(pts, diag) : recognizeOpen(pts, gap)
}

/** Trung bình trượt (giữ nguyên hai đầu) để loại rung tần số cao trước khi đo độ thẳng. */
function smoothPath(pts: Point[], w: number): Point[] {
  if (w <= 1) return pts
  const h = Math.floor(w / 2)
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p
    const lo = Math.max(0, i - h), hi = Math.min(pts.length - 1, i + h)
    let x = 0, y = 0
    for (let k = lo; k <= hi; k++) { x += pts[k].x; y += pts[k].y }
    const n = hi - lo + 1
    return { x: x / n, y: y / n }
  })
}

function recognizeOpen(pts: Point[], chord: number): Recognition {
  const straightness = chord / pathLength(smoothPath(pts, TUNING.lineSmooth))
  if (straightness < TUNING.lineStraightness) return none(0.2)

  let a = { ...pts[0] }
  let b = { ...pts[pts.length - 1] }
  // Gần ngang hoặc gần dọc thì kéo cho đúng ngang/dọc
  const angle = Math.abs(deg(Math.atan2(b.y - a.y, b.x - a.x)))
  if (angle < 6 || angle > 174) { const y = (a.y + b.y) / 2; a = { x: a.x, y }; b = { x: b.x, y } }
  else if (Math.abs(angle - 90) < 6) { const x = (a.x + b.x) / 2; a = { x, y: a.y }; b = { x, y: b.y } }

  const confidence = 0.55 + 0.45 * clamp((straightness - TUNING.lineStraightness) / 0.06, 0, 1)
  return { kind: 'line', confidence, fit: { kind: 'line', a, b } }
}

/** Đo độ khớp elip trong hệ trục xoay theta: trả về bán trục, tâm và sai lệch bán kính chuẩn hoá e. */
function measureEllipse(pts: Point[], theta: number) {
  const c = Math.cos(theta), s = Math.sin(theta)
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity
  const uv = pts.map((p) => {
    const u = p.x * c + p.y * s
    const v = -p.x * s + p.y * c
    if (u < uMin) uMin = u
    if (u > uMax) uMax = u
    if (v < vMin) vMin = v
    if (v > vMax) vMax = v
    return { u, v }
  })
  const a = Math.max((uMax - uMin) / 2, 1e-6)
  const b = Math.max((vMax - vMin) / 2, 1e-6)
  const uc = (uMax + uMin) / 2, vc = (vMax + vMin) / 2
  const r = uv.map(({ u, v }) => Math.hypot((u - uc) / a, (v - vc) / b))
  const mean = r.reduce((x, y) => x + y, 0) / r.length
  const std = Math.sqrt(r.reduce((x, y) => x + (y - mean) ** 2, 0) / r.length)
  return { a, b, center: { x: uc * c - vc * s, y: uc * s + vc * c }, e: std / mean }
}

function fitEllipse(pts: Point[]) {
  const n = pts.length
  const mx = pts.reduce((x, p) => x + p.x, 0) / n
  const my = pts.reduce((x, p) => x + p.y, 0) / n
  let sxx = 0, syy = 0, sxy = 0
  for (const p of pts) { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my) }
  let theta = 0.5 * Math.atan2(2 * sxy, sxx - syy) // (-90°, 90°]
  const td = Math.abs(deg(theta))
  if (td < TUNING.axisSnapDeg || td > 90 - TUNING.axisSnapDeg) theta = 0

  let m = measureEllipse(pts, theta)
  const circle = Math.abs(m.a - m.b) / Math.max(m.a, m.b) < TUNING.circleRatio
  if (circle) {
    theta = 0
    m = measureEllipse(pts, 0)
    const r = (m.a + m.b) / 2
    m = { ...m, a: r, b: r }
  }
  return { ...m, theta, circle }
}

/** Tìm các điểm có góc rẽ gấp trên đường khép kín. Trả về chỉ số mẫu, đã sắp xếp. */
function findCorners(pts: Point[]): number[] {
  const n = pts.length, w = TUNING.cornerWindow
  const turn = pts.map((_, i) => 180 - interiorAngle(pts[(i - w + n) % n], pts[i], pts[(i + w) % n]))
  const median = [...turn].sort((a, b) => a - b)[n >> 1]
  const thr = Math.max(TUNING.cornerMinTurn, TUNING.cornerMedianK * median)
  const order = turn.map((_, i) => i).filter((i) => turn[i] >= thr).sort((a, b) => turn[b] - turn[a])
  const picked: number[] = []
  for (const i of order) if (picked.every((j) => circDist(i, j, n) > 2 * w)) picked.push(i)
  return picked.sort((a, b) => a - b)
}

/** Dựng đỉnh sắc nét: khớp đường thẳng cho từng cạnh rồi lấy giao của hai cạnh kề nhau. */
function refineVertices(pts: Point[], corners: number[], diag: number): Point[] {
  const n = pts.length, m = corners.length
  const lines = corners.map((s, j) => {
    const e = corners[(j + 1) % m]
    const span = (e - s + n) % n
    const margin = Math.min(TUNING.cornerMargin, Math.floor(span / 4))
    const seg: Point[] = []
    for (let t = margin; t <= span - margin; t++) seg.push(pts[(s + t) % n])
    return seg.length >= 3 ? fitLine(seg) : null
  })
  return corners.map((idx, j) => {
    const a = lines[(j - 1 + m) % m], b = lines[j]
    const hit = a && b ? intersectLines(a.c, a.d, b.c, b.d) : null
    return hit && dist(hit, pts[idx]) < 0.25 * diag ? hit : pts[idx]
  })
}

/** Gộp đỉnh quá gần và bỏ đỉnh gần thẳng hàng. */
function cleanPolygon(v: Point[], diag: number): Point[] {
  const p = v.slice()
  let changed = true
  while (changed && p.length > 2) {
    changed = false
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length
      if (dist(p[i], p[j]) < TUNING.mergeDist * diag) {
        const mid = { x: (p[i].x + p[j].x) / 2, y: (p[i].y + p[j].y) / 2 }
        if (j === 0) { p.pop(); p[0] = mid } else p.splice(i, 2, mid)
        changed = true
        break
      }
    }
  }
  while (p.length > 3) {
    let best = -1, bestAngle: number = TUNING.mergeAngle
    for (let i = 0; i < p.length; i++) {
      const ang = interiorAngle(p[(i - 1 + p.length) % p.length], p[i], p[(i + 1) % p.length])
      if (ang > bestAngle) { bestAngle = ang; best = i }
    }
    if (best < 0) break
    p.splice(best, 1)
  }
  return p
}

function polygonError(pts: Point[], poly: Point[], diag: number): number {
  let sum = 0
  for (const p of pts) {
    let d = Infinity
    for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSegment(p, poly[i], poly[(i + 1) % poly.length]))
    sum += d
  }
  return sum / pts.length / diag
}

const polygonConfidence = (err: number) => 0.5 + 0.5 * clamp(1 - err / 0.05, 0, 1)

function ellipseResult(el: ReturnType<typeof fitEllipse>): Recognition {
  const confidence = 0.5 + 0.5 * clamp(1 - (el.e - 0.03) / 0.08, 0, 1)
  return {
    kind: el.circle ? 'circle' : 'ellipse',
    confidence,
    fit: { kind: 'ellipse', center: el.center, w: el.a * 2, h: el.b * 2, rotation: el.theta, circle: el.circle },
  }
}

function recognizeClosed(pts: Point[], diag: number): Recognition {
  const corners = findCorners(pts)

  // Không có góc rõ rệt (hoặc chỉ 2 đầu nhọn của elip dẹt): thử elip
  if (corners.length <= 2) {
    const el = fitEllipse(pts)
    return el.e < TUNING.ellipseMaxE ? ellipseResult(el) : none(0.3)
  }

  if (corners.length > TUNING.maxCorners) return none(0.3)
  const poly = cleanPolygon(refineVertices(pts, corners, diag), diag)
  const k = poly.length
  if (k < 3) return none(0.3)
  const polyErr = polygonError(pts, poly, diag)

  // Elip dẹt có hai đầu nhọn dễ bị dò thành 3-4 góc: nếu elip khớp tốt mà đa giác khớp tệ thì chọn elip
  const el = fitEllipse(pts)
  if (el.e < TUNING.ellipseBeatsPolygonE && polyErr > TUNING.ellipseBeatsPolygonErr) {
    return ellipseResult(el)
  }

  const confidence = polygonConfidence(polyErr)
  if (k === 4) {
    const rect = asRectangle(poly)
    if (rect) return { kind: 'rectangle', confidence, fit: rect }
  }
  return { kind: k === 3 ? 'triangle' : 'polygon', confidence, fit: { kind: 'polygon', vertices: poly } }
}

/** Nếu 4 đỉnh gần thành hình chữ nhật thì trả về hình chữ nhật chuẩn (có thể xoay). */
function asRectangle(q: Point[]): Extract<Recognition['fit'], { kind: 'rectangle' }> | null {
  for (let i = 0; i < 4; i++) {
    if (Math.abs(interiorAngle(q[(i + 3) % 4], q[i], q[(i + 1) % 4]) - 90) > 20) return null
  }
  const l = [0, 1, 2, 3].map((i) => dist(q[i], q[(i + 1) % 4]))
  const r1 = l[0] / l[2], r2 = l[1] / l[3]
  if (r1 < 0.7 || r1 > 1.43 || r2 < 0.7 || r2 > 1.43) return null

  const center = { x: q.reduce((s, p) => s + p.x, 0) / 4, y: q.reduce((s, p) => s + p.y, 0) / 4 }
  const dx = (q[1].x - q[0].x + (q[2].x - q[3].x)) / 2
  const dy = (q[1].y - q[0].y + (q[2].y - q[3].y)) / 2
  let theta = Math.atan2(dy, dx)
  while (theta > Math.PI / 2) theta -= Math.PI
  while (theta <= -Math.PI / 2) theta += Math.PI
  let w = (l[0] + l[2]) / 2
  let h = (l[1] + l[3]) / 2

  const td = Math.abs(deg(theta))
  if (td < TUNING.axisSnapDeg || td > 90 - TUNING.axisSnapDeg) {
    const b = bounds(q)
    w = b.w; h = b.h; theta = 0
  }
  const square = Math.abs(w - h) / Math.max(w, h) < 0.1
  if (square) w = h = (w + h) / 2
  return { kind: 'rectangle', center, w, h, rotation: theta, square }
}
