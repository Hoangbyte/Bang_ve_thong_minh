export interface SpecialPoint { kind: 'yint' | 'xint' | 'max' | 'min'; x: number; y: number }

function bisect(f: (x: number) => number, lo: number, hi: number): number {
  let fl = f(lo)
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2, fm = f(mid)
    if (fm === 0) return mid
    if (fl * fm < 0) hi = mid
    else { lo = mid; fl = fm }
  }
  return (lo + hi) / 2
}

function refineExtremum(f: (x: number) => number, lo: number, hi: number, isMax: boolean): number {
  for (let i = 0; i < 60; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3
    if (isMax ? f(m1) < f(m2) : f(m1) > f(m2)) lo = m1
    else hi = m2
  }
  return (lo + hi) / 2
}

/**
 * Tìm điểm đặc biệt của y = f(x) trong [x0, x1]: giao Oy, giao Ox, cực đại, cực tiểu.
 * Quét 800 mẫu, nghi ngờ gián đoạn (tiệm cận như 1/x, tan x) khi hai mẫu liền kề lệch quá 40% biên độ.
 */
export function findSpecialPoints(f: (x: number) => number, x0: number, x1: number): SpecialPoint[] {
  const N = 800
  const xs: number[] = [], ys: number[] = []
  for (let i = 0; i <= N; i++) {
    const x = x0 + ((x1 - x0) * i) / N
    const y = f(x)
    xs.push(x)
    ys.push(Number.isFinite(y) ? y : NaN)
  }
  const fin = ys.filter(Number.isFinite).sort((a, b) => a - b)
  const out: SpecialPoint[] = []
  const y0 = f(0)
  if (Number.isFinite(y0)) out.push({ kind: 'yint', x: 0, y: y0 })
  if (fin.length < 10) return out

  const S = Math.max(fin[Math.floor(fin.length * 0.95)] - fin[Math.floor(fin.length * 0.05)], 1e-9)
  const jump = (a: number, b: number) => !(Number.isFinite(a) && Number.isFinite(b)) || Math.abs(a - b) > 0.4 * S
  const tol = 1e-6 * Math.max(1, S)

  // Giao Ox
  const roots: number[] = []
  const addRoot = (x: number) => { if (!roots.some((r) => Math.abs(r - x) < 1e-6 * (1 + Math.abs(x)))) roots.push(x) }
  for (let i = 0; i < N; i++) {
    const a = ys[i], b = ys[i + 1]
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    if (a === 0) addRoot(xs[i])
    else if (a * b < 0 && !jump(a, b)) {
      const r = bisect(f, xs[i], xs[i + 1])
      if (Math.abs(f(r)) < tol) addRoot(r)
    }
  }
  if (ys[N] === 0) addRoot(xs[N])

  // Cực trị
  const ext: SpecialPoint[] = []
  const step = (x1 - x0) / N
  const eps = 1e-12 * S
  for (let i = 1; i < N; i++) {
    const a = ys[i - 1], b = ys[i], c = ys[i + 1]
    if (jump(a, b) || jump(b, c)) continue
    const d1 = b - a, d2 = c - b
    const isMax = d1 > eps && d2 < -eps
    const isMin = d1 < -eps && d2 > eps
    if (!isMax && !isMin) continue
    const kind = isMax ? 'max' : 'min'
    const x = refineExtremum(f, xs[i - 1], xs[i + 1], isMax)
    const y = f(x)
    if (!Number.isFinite(y) || ext.some((p) => p.kind === kind && Math.abs(p.x - x) < 3 * step)) continue
    ext.push({ kind, x, y })
    if (Math.abs(y) < tol) addRoot(x) // nghiệm kép: đồ thị chỉ chạm trục Ox
  }

  // Hàm hằng bằng 0: cả đường là nghiệm, không liệt kê
  const rootPts = roots.length > 40 ? [] : roots.map((x) => ({ kind: 'xint' as const, x, y: 0 }))
  const mid = (x0 + x1) / 2
  const near = (p: SpecialPoint) => Math.abs(p.x - mid)
  const cap = (arr: SpecialPoint[]) => arr.sort((p, q) => near(p) - near(q)).slice(0, 12).sort((p, q) => p.x - q.x)
  return [...out, ...cap(rootPts), ...cap(ext.filter((p) => p.kind === 'max')), ...cap(ext.filter((p) => p.kind === 'min'))]
}

/** Giao điểm của hai đồ thị y = f(x) và y = g(x): nghiệm của f - g = 0. */
export function findIntersections(f: (x: number) => number, g: (x: number) => number, x0: number, x1: number): { x: number; y: number }[] {
  return findSpecialPoints((x) => f(x) - g(x), x0, x1)
    .filter((p) => p.kind === 'xint')
    .map((p) => ({ x: p.x, y: f(p.x) }))
    .filter((p) => Number.isFinite(p.y))
}
