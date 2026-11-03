import { fmt } from './format'

const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15]
const TOL = 1e-6

/** Nhận ra dạng đẹp của số: nguyên, phân số p/q (q ≤ 12) hoặc k√n; còn lại hiện số thập phân kiểu Việt. */
export function niceNumber(v: number, exact?: Exact[]): string {
  if (!Number.isFinite(v) || Math.abs(v) < 1e-9) return fmt(v)
  const hit = exact?.find((e) => Math.abs(e.value - v) < 1e-6)
  if (hit) return hit.text
  if (Math.abs(v - Math.round(v)) < TOL) return fmt(Math.round(v))
  for (let q = 2; q <= 12; q++) {
    const p = Math.round(v * q)
    if (Math.abs(v * q - p) < TOL * q) return `${p < 0 ? '−' : ''}${Math.abs(p)}/${q}`
  }
  for (const n of SQUAREFREE) {
    const k = v / Math.sqrt(n)
    const r = Math.round(k)
    if (r !== 0 && Math.abs(k - r) < TOL) return `${r < 0 ? '−' : ''}${Math.abs(r) === 1 ? '' : Math.abs(r)}√${n}`
  }
  return fmt(v)
}

export interface Exact { value: number; text: string }
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a))

/** Nghiệm đúng của f nếu f là bậc 2 hệ số hữu tỉ và Δ > 0 không chính phương: dạng (p ± s√n)/d. Ngược lại trả []. */
export function quadraticExact(f: (x: number) => number): Exact[] {
  const f0 = f(0), f1 = f(1), fm = f(-1)
  if (![f0, f1, fm].every(Number.isFinite)) return []
  const a = (f1 + fm) / 2 - f0, b = (f1 - fm) / 2, c = f0
  if (Math.abs(a) < 1e-9) return []
  for (const x of [2, -3, 0.5]) if (Math.abs(f(x) - (a * x * x + b * x + c)) > 1e-6 * (1 + Math.abs(f(x)))) return []
  let m = 0
  for (let k = 1; k <= 12 && !m; k++) if ([a, b, c].every((v) => Math.abs(v * k - Math.round(v * k)) < 1e-6)) m = k
  if (!m) return []
  const A = Math.round(a * m), B = Math.round(b * m), C = Math.round(c * m)
  const D = B * B - 4 * A * C
  if (D <= 0 || Number.isInteger(Math.sqrt(D))) return []
  let s = 1, n = D
  for (let k = Math.floor(Math.sqrt(D)); k >= 2; k--) if (D % (k * k) === 0) { s = k; n = D / (k * k); break }
  let p = -B, d = 2 * A
  if (d < 0) { d = -d; p = -p }
  const g = gcd(gcd(p, s), d)
  p /= g; s /= g; d /= g
  const sq = `${s === 1 ? '' : s}√${n}`
  return [-1, 1].map((sg) => {
    const value = (p + sg * s * Math.sqrt(n)) / d
    const body = p === 0 ? `${sg < 0 ? '−' : ''}${sq}` : `${p < 0 ? '−' : ''}${Math.abs(p)} ${sg < 0 ? '−' : '+'} ${sq}`
    return { value, text: d === 1 ? body : p === 0 ? `${body}/${d}` : `(${body})/${d}` }
  }).sort((u, v) => u.value - v.value)
}
