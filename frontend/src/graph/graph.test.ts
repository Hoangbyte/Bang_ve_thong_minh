import { describe, expect, it } from 'vitest'
import { analyse, makeEvaluator } from './model'
import { findIntersections, findSpecialPoints } from './analysis'
import { latexToExpr } from './latex'
import { niceNumber, quadraticExact } from './nice'
import { renderGraphSvg, cardPalette, type Curve } from './render'
import { PLOT_H, PLOT_W } from './view'

function ev(input: string) {
  const m = analyse(input)
  if (!m.ok) throw new Error(m.error)
  return makeEvaluator(m, {})
}
const roots = (input: string) =>
  findSpecialPoints(ev(input).f, -10, 10).filter((p) => p.kind === 'xint').map((p) => +p.x.toFixed(3))

describe('đồ thị', () => {
  it('bậc 2', () => expect(roots('y = x² - 4x + 3')).toEqual([1, 3]))
  it('bậc 3', () => expect(roots('y = x³ - 3x')).toEqual([-1.732, 0, 1.732]))
  it('phương trình = 0', () => expect(roots('x^2-4x+3=0')).toEqual([1, 3]))
  it('phương trình hai vế', () => expect(roots('x^2 = 4')).toEqual([-2, 2]))
  it('giá trị tuyệt đối', () => expect(roots('y=|x|-2')).toEqual([-2, 2]))
  it('LaTeX', () => expect(roots('y=\\frac{1}{2}x^{2}-2')).toEqual([-2, 2]))
  it('chuyển LaTeX', () => expect(latexToExpr('\\sin\\left(x\\right)')).toBe('sin(x)'))
  it('bất phương trình giữ nguyên quan hệ', () => {
    const m = analyse('y > x^2')
    expect(m.ok && m.rel).toBe('>')
  })
  it('LaTeX bất phương trình', () => {
    const m = analyse('y \\ge x^2')
    expect(m.ok && m.rel).toBe('>=')
  })
  it('nghiệm dạng đẹp', () => {
    expect(niceNumber(Math.sqrt(3))).toBe('√3')
    expect(niceNumber(-2 * Math.sqrt(2))).toBe('−2√2')
    expect(niceNumber(0.75)).toBe('3/4')
    expect(niceNumber(2)).toBe('2')
    expect(niceNumber(Math.PI)).toBe('3,142')
  })
  it('nghiệm tìm được khớp dạng đẹp', () =>
    expect(findSpecialPoints(ev('y = x^2 - 3').f, -10, 10).filter((p) => p.kind === 'xint').map((p) => niceNumber(p.x))).toEqual(['−√3', '√3']))
  it('bất phương trình theo x', () => {
    const m = analyse('x^2-4>0')
    expect(m.ok && m.kind).toBe('xset')
    const v = analyse('x >= 2')
    expect(v.ok && v.kind).toBe('vertical')
  })
  it('tô miền: x²−4>0 ra 2 dải, x>=2 ra 1 nửa mặt phẳng, x²−4<0 ra 1 dải', () => {
    const shade = (src: string) => {
      const m = analyse(src)
      if (!m.ok) throw new Error(m.error)
      const e = makeEvaluator(m, {})
      const c: Curve = { f: e.f, vertical: e.vertical, rel: e.rel, xset: e.xset, ci: 0 }
      const svg = renderGraphSvg({ w: PLOT_W, h: PLOT_H, view: { cx: 0, cy: 0, ppu: 30 }, curves: [c], points: [], palette: cardPalette })
      return (svg.match(/fill-opacity="0.2"/g) ?? []).length
    }
    expect(shade('x^2-4>0')).toBe(2)
    expect(shade('x >= 2')).toBe(1)
    expect(shade('x^2-4<0')).toBe(1)
    expect(shade('y > x')).toBe(1)
  })
  it('nghiệm đúng của bậc 2', () => {
    const ex = (s: string) => quadraticExact(ev(s).f).map((e) => e.text)
    expect(ex('y = x^2 - 2x - 1')).toEqual(['1 − √2', '1 + √2'])
    expect(ex('y = x^2 - 4x + 1')).toEqual(['2 − √3', '2 + √3'])
    expect(ex('y = 2x^2 - 2x - 1')).toEqual(['(1 − √3)/2', '(1 + √3)/2'])
    expect(ex('y = x^2 - 3')).toEqual(['−√3', '√3'])
    expect(ex('y = x^2 - 5x + 6')).toEqual([])
    expect(ex('y = x^2 + 1')).toEqual([])
    expect(ex('y = x^3 - 2x')).toEqual([])
  })
  it('đường thẳng đứng', () => expect(ev('x = 3').vertical).toBe(3))
  it('giao điểm hai đồ thị', () => {
    const pts = findIntersections(ev('y=x^2').f, ev('y=x+2').f, -10, 10).map((p) => [+p.x.toFixed(2), +p.y.toFixed(2)])
    expect(pts).toEqual([[-1, 1], [2, 4]])
  })
  it('từ chối y hai vế, lệnh lạ, y lẫn trong bất phương trình', () => {
    expect(analyse('y = x^2 + y').ok).toBe(false)
    expect(analyse('y=\\foo{x}').ok).toBe(false)
    expect(analyse('x^2 + y > 0').ok).toBe(false)
  })
})
