import { findIntersections, findSpecialPoints } from './analysis'

/** Khung nhìn: tâm (thế giới), số pixel trên một đơn vị. Tỉ lệ x:y luôn 1:1. */
export interface View { cx: number; cy: number; ppu: number }

export const PLOT_W = 340
export const PLOT_H = 270
export const clampPpu = (p: number) => Math.max(2, Math.min(2000, p))

export function zoomAt(v: View, px: number, py: number, factor: number, w = PLOT_W, h = PLOT_H): View {
  const ppu = clampPpu(v.ppu * factor)
  const wx = v.cx + (px - w / 2) / v.ppu
  const wy = v.cy - (py - h / 2) / v.ppu
  return { ppu, cx: wx - (px - w / 2) / ppu, cy: wy + (py - h / 2) / ppu }
}

export interface FitItem { f: ((x: number) => number) | null; vertical: number | null }

/** Chọn khung nhìn vừa các điểm đặc biệt và giao điểm của mọi đường (luôn gồm gốc O để thấy trục). */
export function fitView(items: FitItem[], w = PLOT_W, h = PLOT_H): View {
  const px: number[] = [0], py: number[] = [0]
  let interesting = false
  for (const it of items) {
    if (it.vertical !== null && Number.isFinite(it.vertical)) {
      px.push(it.vertical); py.push(-4, 4); interesting = true
    } else if (it.f) {
      for (const p of findSpecialPoints(it.f, -10, 10)) {
        px.push(p.x); py.push(p.y)
        if (p.kind !== 'yint' && Math.abs(p.x) + Math.abs(p.y) > 1e-9) interesting = true
      }
    }
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i].f, b = items[j].f
    if (!a || !b) continue
    for (const p of findIntersections(a, b, -10, 10)) { px.push(p.x); py.push(p.y); interesting = true }
  }
  // Không có điểm đặc biệt nào (đường thẳng, mũ...): lấy thêm hai mẫu để thấy hướng đi
  if (!interesting) {
    for (const it of items) for (const x of [-3, 3]) {
      const y = it.f ? it.f(x) : NaN
      if (Number.isFinite(y) && Math.abs(y) < 100) { px.push(x); py.push(y) }
    }
  }
  const grow = (a: number, b: number, min: number): [number, number] => {
    const span = Math.max(b - a, min), c = (a + b) / 2
    return [c - span * 0.7, c + span * 0.7] // chừa 40% lề
  }
  const [xmin, xmax] = grow(Math.min(...px), Math.max(...px), 4)
  const [ymin, ymax] = grow(Math.min(...py), Math.max(...py), 4)
  return {
    cx: (xmin + xmax) / 2,
    cy: (ymin + ymax) / 2,
    ppu: clampPpu(Math.min(w / (xmax - xmin), h / (ymax - ymin))),
  }
}
