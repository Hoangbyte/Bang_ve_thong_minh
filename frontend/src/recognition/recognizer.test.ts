import { describe, expect, it } from 'vitest'
import { MIN_SNAP_CONFIDENCE, recognizeStroke } from './recognizer'
import type { Point } from './types'

// Nét tay giả có nhiễu (số ngẫu nhiên cố định nên kết quả lặp lại được).
// "Nhận đúng" = đúng loại hình VÀ đủ độ tin cậy để giao diện tự nắn (MIN_SNAP_CONFIDENCE).
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const jitter = (pts: Point[], r: () => number, amp: number) => pts.map((p) => ({ x: p.x + (r() - 0.5) * amp, y: p.y + (r() - 0.5) * amp }))
function dense(corners: Point[], per: number, closed: boolean): Point[] {
  const out: Point[] = []
  const n = closed ? corners.length : corners.length - 1
  for (let i = 0; i < n; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length]
    for (let k = 0; k < per; k++) out.push({ x: a.x + ((b.x - a.x) * k) / per, y: a.y + ((b.y - a.y) * k) / per })
  }
  out.push(closed ? { ...corners[0] } : corners[corners.length - 1])
  return out
}
const ngon = (n: number): Point[] => Array.from({ length: n }, (_, i) => ({ x: 300 + 120 * Math.cos((i / n) * 2 * Math.PI), y: 300 + 120 * Math.sin((i / n) * 2 * Math.PI) }))
function ellipse(rx: number, ry: number, r: () => number): Point[] {
  const s = r() * Math.PI * 2
  return Array.from({ length: 90 }, (_, i) => ({ x: 300 + rx * Math.cos(s + (i / 88) * Math.PI * 2), y: 300 + ry * Math.sin(s + (i / 88) * Math.PI * 2) }))
}
function scribble(r: () => number): Point[] {
  let x = 300, y = 300, a = r() * 6.28
  return Array.from({ length: 80 }, () => { a += (r() - 0.5) * 2.4; x += 14 * Math.cos(a); y += 14 * Math.sin(a); return { x, y } })
}

type Maker = { kinds: string[]; make: (r: () => number) => Point[] }
export const PRIORITY: Record<string, Maker> = {
  line: { kinds: ['line'], make: (r) => dense([{ x: 100, y: 100 }, { x: 320 + r() * 80, y: 140 + r() * 60 }], 120, false) },
  circle: { kinds: ['circle', 'ellipse'], make: (r) => ellipse(100, 100, r) },
  ellipse: { kinds: ['ellipse'], make: (r) => ellipse(140, 80, r) },
  rectangle: { kinds: ['rectangle'], make: () => dense([{ x: 100, y: 100 }, { x: 330, y: 100 }, { x: 330, y: 230 }, { x: 100, y: 230 }], 25, true) },
  triangle: { kinds: ['triangle', 'polygon'], make: () => dense([{ x: 100, y: 250 }, { x: 330, y: 250 }, { x: 200, y: 90 }], 30, true) },
  ...Object.fromEntries([5, 6, 7, 8].map((n) => [`${n} cạnh`, { kinds: ['polygon'], make: () => dense(ngon(n), Math.round(180 / n), true) }])),
}

export function snapRate(shape: string, amp: number, runs = 60): number {
  const { kinds, make } = PRIORITY[shape]
  const r = rng(7)
  let ok = 0
  for (let i = 0; i < runs; i++) {
    // Đường thẳng lấy nhiều điểm như bút thật; rung tối đa ±1,5 px (nhiễu lớn hơn trên từng điểm không thực tế)
    const res = recognizeStroke(jitter(make(r), r, shape === 'line' ? Math.min(amp, 3) : amp))
    if (kinds.includes(res.kind) && res.confidence >= MIN_SNAP_CONFIDENCE) ok++
  }
  return ok / runs
}
/** Tỉ lệ nét nguệch ngoạc được giữ nguyên (không bị nắn thành hình nào). */
export function keepRate(runs = 60): number {
  const r = rng(3)
  let ok = 0
  for (let i = 0; i < runs; i++) {
    const res = recognizeStroke(scribble(r))
    if (res.kind === 'unknown' || res.confidence < MIN_SNAP_CONFIDENCE) ok++
  }
  return ok / runs
}

describe('hình ưu tiên được nắn đúng (nhiễu vừa)', () => {
  for (const shape of Object.keys(PRIORITY)) it(shape, () => expect(snapRate(shape, 6)).toBeGreaterThanOrEqual(0.9))
})
describe('nhiễu mạnh vẫn chấp nhận được', () => {
  for (const shape of ['line', 'circle', 'ellipse', 'rectangle', 'triangle', '5 cạnh', '6 cạnh']) it(shape, () => expect(snapRate(shape, 10)).toBeGreaterThanOrEqual(0.8))
})
describe('đường thẳng và cung cong', () => {
  const arc = (sag: number, r: () => number): Point[] => Array.from({ length: 80 }, (_, i) => { const t = i / 79; return { x: 100 + 260 * t, y: 100 + 4 * sag * 260 * t * (1 - t) + (r() - 0.5) * 2 } })
  const isLine = (pts: Point[]) => { const res = recognizeStroke(pts); return res.kind === 'line' && res.confidence >= MIN_SNAP_CONFIDENCE }
  it('rung kiểu ngón tay (±2 px, 120 điểm) vẫn là đường thẳng', () => {
    const r = rng(9); let ok = 0
    for (let i = 0; i < 60; i++) ok += isLine(jitter(dense([{ x: 100, y: 100 }, { x: 360, y: 160 }], 120, false), r, 4)) ? 1 : 0
    expect(ok / 60).toBeGreaterThanOrEqual(0.9)
  })
  it('cung võng 8% vẫn nắn thành đường thẳng', () => { const r = rng(4); expect(isLine(arc(0.08, r))).toBe(true) })
  it('cung võng 30% không bị nắn thành đường thẳng', () => { const r = rng(4); expect(isLine(arc(0.3, r))).toBe(false) })
})
describe('nét nguệch ngoạc được giữ nguyên', () => {
  it('không bị nắn thành hình', () => expect(keepRate()).toBeGreaterThanOrEqual(0.9))
})
