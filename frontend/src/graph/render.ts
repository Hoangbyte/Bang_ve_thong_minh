import { fmt } from './format'
import type { Rel } from './model'
import type { View } from './view'

export interface Palette { bg: string; grid: string; axis: string; text: string; curves: string[]; point: string }

/** Bảng màu cho xem trước trong bảng bên phải (theo sáng/tối của ứng dụng). */
export const livePalette: Palette = {
  bg: 'var(--surface)', grid: 'var(--grid)', axis: 'var(--ink)', text: 'var(--muted)',
  curves: ['var(--accent)', '#5b8cff', '#ff6b6b', '#c77dff', '#f59f00', '#12b886'], point: '#e03131',
}
/** Bảng màu cố định khi thả lên bảng: thẻ sáng, đọc được trên cả nền tối. */
export const cardPalette: Palette = {
  bg: '#ffffff', grid: '#dfe6e2', axis: '#16231f', text: '#51615b',
  curves: ['#1f7a63', '#3b5bdb', '#e03131', '#ae3ec9', '#e67700', '#0b7285'], point: '#d6336c',
}

export interface Curve {
  f: (x: number) => number
  vertical: number | null
  rel: Rel
  xset?: boolean
  /** Chỉ số dòng, quyết định màu. */
  ci: number
}

export interface RenderOptions {
  w: number
  h: number
  view: View
  curves: Curve[]
  /** Điểm cần chấm và ghi toạ độ (điểm đặc biệt, giao điểm). */
  points: { x: number; y: number }[]
  palette: Palette
  /** 1 = xem trước; 2 = ảnh thả lên bảng (mọi kích thước nhân đôi). */
  scale?: number
  /** Dòng chú thích góc dưới trái (sẽ được escape). */
  caption?: string
  /** true: SVG co giãn theo khung chứa (xem trước). */
  responsive?: boolean
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n2 = (v: number) => v.toFixed(1)

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  return ([1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) as number)
}

/** Chia đồ thị thành các đoạn liên tục (ngắt ở tiệm cận hoặc chỗ hàm không xác định), toạ độ màn hình. */
function segmentsOf(f: (x: number) => number, view: View, w: number, h: number): [number, number][][] {
  const segs: [number, number][][] = []
  let cur: [number, number][] | null = null
  let prev = 0
  const n = Math.ceil(w)
  for (let i = 0; i <= n; i++) {
    const sx = (i * w) / n
    const y = f(view.cx + (sx - w / 2) / view.ppu)
    const sy = Number.isFinite(y) ? h / 2 - (y - view.cy) * view.ppu : NaN
    if (!Number.isFinite(sy) || Math.abs(sy) > 1e6) { cur = null; continue }
    if (cur && Math.abs(sy - prev) > 1.5 * h) cur = null // tiệm cận: ngắt nét
    if (!cur) { cur = []; segs.push(cur) }
    cur.push([sx, sy])
    prev = sy
  }
  return segs
}

export function renderGraphSvg(o: RenderOptions): string {
  const { w, h, view, curves, points, palette: P } = o
  const s = o.scale ?? 1
  const { cx, cy, ppu } = view
  const X = (x: number) => w / 2 + (x - cx) * ppu
  const Y = (y: number) => h / 2 - (y - cy) * ppu
  const xmin = cx - w / 2 / ppu, xmax = cx + w / 2 / ppu
  const ymin = cy - h / 2 / ppu, ymax = cy + h / 2 / ppu
  const step = niceStep((55 * s) / ppu)
  const ax = X(0), ay = Y(0)
  const axVisible = ax >= 0 && ax <= w, ayVisible = ay >= 0 && ay <= h
  const fs = 10 * s
  const grid: string[] = [], fills: string[] = [], axes: string[] = [], lines: string[] = [], dots: string[] = []

  // Lưới + nhãn số
  for (let k = Math.ceil(xmin / step); k * step <= xmax; k++) {
    const x = X(k * step)
    grid.push(`<line x1="${n2(x)}" y1="0" x2="${n2(x)}" y2="${h}" stroke="${P.grid}" stroke-width="${s}"/>`)
    if (k !== 0) grid.push(`<text x="${n2(x)}" y="${n2(Math.min(Math.max(ay + 13 * s, 12 * s), h - 4 * s))}" font-size="${fs}" fill="${P.text}" text-anchor="middle">${fmt(k * step)}</text>`)
  }
  for (let k = Math.ceil(ymin / step); k * step <= ymax; k++) {
    const y = Y(k * step)
    grid.push(`<line x1="0" y1="${n2(y)}" x2="${w}" y2="${n2(y)}" stroke="${P.grid}" stroke-width="${s}"/>`)
    if (k !== 0) grid.push(`<text x="${n2(Math.min(Math.max(ax - 5 * s, 30 * s), w - 4 * s))}" y="${n2(y + 3.5 * s)}" font-size="${fs}" fill="${P.text}" text-anchor="end">${fmt(k * step)}</text>`)
  }

  // Trục Oxy
  if (ayVisible) {
    axes.push(`<line x1="0" y1="${n2(ay)}" x2="${w}" y2="${n2(ay)}" stroke="${P.axis}" stroke-width="${1.5 * s}"/>`)
    axes.push(`<polygon points="${w - 2 * s},${n2(ay)} ${w - 9 * s},${n2(ay - 3.5 * s)} ${w - 9 * s},${n2(ay + 3.5 * s)}" fill="${P.axis}"/>`)
    axes.push(`<text x="${w - 10 * s}" y="${n2(ay - 8 * s)}" font-size="${12 * s}" font-style="italic" fill="${P.axis}" text-anchor="end">x</text>`)
  }
  if (axVisible) {
    axes.push(`<line x1="${n2(ax)}" y1="0" x2="${n2(ax)}" y2="${h}" stroke="${P.axis}" stroke-width="${1.5 * s}"/>`)
    axes.push(`<polygon points="${n2(ax)},${2 * s} ${n2(ax - 3.5 * s)},${9 * s} ${n2(ax + 3.5 * s)},${9 * s}" fill="${P.axis}"/>`)
    axes.push(`<text x="${n2(ax + 8 * s)}" y="${14 * s}" font-size="${12 * s}" font-style="italic" fill="${P.axis}">y</text>`)
  }
  if (axVisible && ayVisible) axes.push(`<text x="${n2(ax - 6 * s)}" y="${n2(ay + 13 * s)}" font-size="${fs + s}" fill="${P.axis}" text-anchor="end">O</text>`)

  // Đồ thị, tô miền của bất phương trình
  for (const c of curves) {
    const color = P.curves[c.ci % P.curves.length]
    if (c.vertical !== null && Number.isFinite(c.vertical)) {
      const vx = X(c.vertical)
      const a = Math.min(w, Math.max(0, vx))
      if (c.rel !== '=') {
        const right = c.rel === '>' || c.rel === '>='
        fills.push(`<rect x="${n2(right ? a : 0)}" y="0" width="${n2(right ? w - a : a)}" height="${h}" fill="${color}" fill-opacity="0.2"/>`)
      }
      const vdash = c.rel === '<' || c.rel === '>' ? ` stroke-dasharray="${6 * s} ${5 * s}"` : ''
      lines.push(`<line x1="${n2(vx)}" y1="0" x2="${n2(vx)}" y2="${h}" stroke="${color}" stroke-width="${2.5 * s}"${vdash}/>`)
      continue
    }
    const segs = segmentsOf(c.f, view, w, h)
    const strict = !c.xset && (c.rel === '<' || c.rel === '>')
    if (c.xset) {
      // Dải thẳng đứng nơi f(x) thoả quan hệ với 0 (f = vế trái − vế phải)
      const ok = (x: number) => {
        const y = c.f(x)
        if (!Number.isFinite(y)) return false
        return c.rel === '>' ? y > 0 : c.rel === '>=' ? y >= -1e-9 : c.rel === '<' ? y < 0 : y <= 1e-9
      }
      const n = Math.ceil(w)
      let start = -1
      for (let i = 0; i <= n; i++) {
        const sx = (i * w) / n
        const good = ok(view.cx + (sx - w / 2) / view.ppu)
        if (good && start < 0) start = sx
        if ((!good || i === n) && start >= 0) { fills.push(`<rect x="${n2(start)}" y="0" width="${n2(sx - start)}" height="${h}" fill="${color}" fill-opacity="0.2"/>`); start = -1 }
      }
    }
    const dash = strict ? ` stroke-dasharray="${6 * s} ${5 * s}"` : ''
    if (c.rel !== '=' && !c.xset) {
      const edge = c.rel === '>' || c.rel === '>=' ? -10 : h + 10 // y > f: tô phía trên (toạ độ màn hình nhỏ hơn)
      for (const seg of segs) {
        if (seg.length < 2) continue
        const d = seg.map(([x, y], i) => `${i ? 'L' : 'M'}${n2(x)} ${n2(y)}`).join('') + `L${n2(seg[seg.length - 1][0])} ${edge}L${n2(seg[0][0])} ${edge}Z`
        fills.push(`<path d="${d}" fill="${color}" fill-opacity="0.2"/>`)
      }
    }
    const d = segs.map((seg) => seg.map(([x, y], i) => `${i ? 'L' : 'M'}${n2(x)} ${n2(y)}`).join('')).join('')
    if (d) lines.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${2.5 * s}" stroke-linejoin="round" stroke-linecap="round"${dash}/>`)
  }

  // Điểm đặc biệt / giao điểm
  let labels = 0
  const seen = new Set<string>()
  for (const p of points) {
    const sx = X(p.x), sy = Y(p.y)
    const key = `${sx.toFixed(1)},${sy.toFixed(1)}`
    if (seen.has(key) || sx < 0 || sx > w || sy < 0 || sy > h) continue // điểm trùng hoặc ngoài khung
    seen.add(key)
    dots.push(`<circle cx="${n2(sx)}" cy="${n2(sy)}" r="${4.5 * s}" fill="${P.point}" stroke="${P.bg}" stroke-width="${1.5 * s}"/>`)
    if (labels++ < 8) {
      const right = sx > w - 90 * s
      dots.push(`<text x="${n2(sx + (right ? -7 : 7) * s)}" y="${n2(sy - 7 * s)}" font-size="${11 * s}" fill="${P.axis}" text-anchor="${right ? 'end' : 'start'}" paint-order="stroke" stroke="${P.bg}" stroke-width="${3 * s}" stroke-linejoin="round">(${fmt(p.x)}; ${fmt(p.y)})</text>`)
    }
  }
  if (o.caption) dots.push(`<text x="${10 * s}" y="${h - 10 * s}" font-size="${12 * s}" fill="${P.text}">${esc(o.caption)}</text>`)

  const size = o.responsive ? 'style="width:100%;height:auto;display:block"' : `width="${w}" height="${h}"`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${size} font-family="'Be Vietnam Pro', system-ui, sans-serif">` +
    `<defs><clipPath id="gclip"><rect width="${w}" height="${h}" rx="${10 * s}"/></clipPath></defs>` +
    `<rect width="${w}" height="${h}" rx="${10 * s}" fill="${P.bg}"/>` +
    `<g clip-path="url(#gclip)">${[...grid, ...fills, ...axes, ...lines, ...dots].join('')}</g></svg>`
  )
}
