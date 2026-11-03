/** Chuyển LaTeX (từ MathLive hoặc API đọc chữ viết tay) sang biểu thức mà parseExpression hiểu. */
function group(s: string, i: number): [string, number] | null {
  if (s[i] !== '{') return null
  let d = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') d++
    else if (s[j] === '}' && --d === 0) return [s.slice(i + 1, j), j + 1]
  }
  return null
}

const FUNCS = new Set(['sin', 'cos', 'tan', 'cot', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'ln', 'log', 'exp'])

export function latexToExpr(src: string): string {
  let s = src
    .replace(/\\[dt]frac/g, '\\frac')
    .replace(/\\frac\s*(\d)\s*(\d)(?!\d)/g, '\\frac{$1}{$2}')
    .replace(/\\(?:mathrm|operatorname|text|mathit)\{([^{}]*)\}/g, (_m, w: string) => (FUNCS.has(w) ? `\\${w}` : w))
    .replace(/\\left|\\right|\\,|\\;|\\!|\\ /g, '')
    .replace(/\\lvert|\\rvert/g, '|')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\le(?![a-z])|\\leq/g, '<=')
    .replace(/\\ge(?![a-z])|\\geq/g, '>=')
    .replace(/\\pi/g, 'pi')
  // \frac{a}{b} -> ((a)/(b)); \sqrt{a} -> sqrt(a). Lặp để xử lý lồng nhau.
  for (let guard = 0; guard < 50; guard++) {
    const r3 = s.indexOf('\\sqrt[') // căn bậc n: \sqrt[n]{a} -> a^(1/n)
    if (r3 >= 0) {
      const close = s.indexOf(']', r3)
      const g = close > 0 ? group(s, close + 1) : null
      if (!g) break
      s = `${s.slice(0, r3)}((${g[0]})^(1/(${s.slice(r3 + 6, close)})))${s.slice(g[1])}`
      continue
    }
    const f = s.indexOf('\\frac')
    if (f >= 0) {
      const a = group(s, f + 5)
      const b = a && group(s, a[1])
      if (!a || !b) break
      s = `${s.slice(0, f)}((${a[0]})/(${b[0]}))${s.slice(b[1])}`
      continue
    }
    const q = s.indexOf('\\sqrt')
    if (q >= 0) {
      const a = group(s, q + 5)
      if (!a) break
      s = `${s.slice(0, q)}sqrt(${a[0]})${s.slice(a[1])}`
      continue
    }
    break
  }
  // Lệnh còn lại không hiểu thì giữ nguyên dấu \ để bộ phân tích báo lỗi rõ ràng
  return s.replace(/\\(sin|cos|tan|cot|sinh|cosh|tanh|arcsin|arccos|arctan|ln|log|exp)(?![a-z])/g, '$1')
}
