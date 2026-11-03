import { describe, expect, it } from 'vitest'
import { analyse, makeEvaluator } from './model'
import { fmt } from './format'
import { niceNumber } from './nice'

const f = (src: string) => {
  const m = analyse(src)
  if (!m.ok) throw new Error(`${src}: ${m.error}`)
  return makeEvaluator(m, {}).f
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

describe('chuẩn hóa LaTeX từ mô hình ngôn ngữ / MathLive', () => {
  it('\\dfrac và \\tfrac', () => expect(near(f('y=\\dfrac{1}{2}x^{2}-2')(2), 0)).toBe(true))
  it('\\frac12 không ngoặc', () => expect(near(f('y=\\frac12x^2-2')(2), 0)).toBe(true))
  it('\\mathrm{e}', () => expect(near(f('y=\\mathrm{e}^{x}')(0), 1)).toBe(true))
  it('\\operatorname{sin}', () => expect(near(f('y=\\operatorname{sin}\\left(x\\right)')(Math.PI / 2), 1)).toBe(true))
  it('căn bậc ba', () => expect(near(f('y=\\sqrt[3]{x}')(8), 2)).toBe(true))
  it('căn bậc hai lồng phân số', () => expect(near(f('y=\\sqrt{\\frac{x}{4}}')(16), 2)).toBe(true))
})
describe('dấu trừ đồng nhất', () => {
  it('số thập phân', () => expect(fmt(-1.5)).toBe('−1,5'))
  it('phân số', () => expect(niceNumber(-0.75)).toBe('−3/4'))
})
