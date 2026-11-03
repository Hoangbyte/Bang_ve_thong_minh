/**
 * Bộ phân tích biểu thức toán: "4x^2 - 3x + 1", "2sin(x)", "a(x-1)(x+2)"...
 * Hỗ trợ nhân ngầm (4x, 2(x+1), ax), x², ^, các hàm sin cos tan cot asin acos atan sinh cosh tanh sqrt abs exp ln log,
 * hằng pi và e. Mọi chữ cái khác x là tham số (a, b, c...).
 */
export type ErrorCode = 'empty' | 'syntax' | 'parens' | 'badChar' | 'unsupported'

export class ParseError extends Error {
  code: ErrorCode
  constructor(code: ErrorCode) {
    super(code)
    this.code = code
  }
}

export type Node =
  | { t: 'num'; v: number }
  | { t: 'const'; name: 'pi' | 'e' }
  | { t: 'var'; name: string }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { t: 'fn'; name: string; a: Node }

type Token = { k: 'num'; v: number } | { k: 'id'; name: string } | { k: 'fn'; name: string } | { k: 'const'; name: 'pi' | 'e' } | { k: 'op'; v: string }

const FUNCS = ['arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan', 'sqrt', 'sin', 'cos', 'tan', 'cot', 'abs', 'exp', 'log', 'ln', 'lg']
const ALIAS: Record<string, string> = { arcsin: 'asin', arccos: 'acos', arctan: 'atan', lg: 'log' }

/** Dấu |...|: dấu đầu mở abs(, dấu sau đóng ). */
const absBar = () => { let open = true; return () => ((open = !open) ? ')' : 'abs(') }

export function normalize(src: string): string {
  return src
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[−–]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/(\d),(\d)/g, '$1.$2') // 0,5 -> 0.5
    .replace(/[[{]/g, '(')
    .replace(/[\]}]/g, ')')
    .replace(/\|/g, absBar())
}

function tokenize(s: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < s.length) {
    const rest = s.slice(i)
    let m = /^(\d+\.?\d*|\.\d+)/.exec(rest)
    if (m) { out.push({ k: 'num', v: parseFloat(m[1]) }); i += m[1].length; continue }
    m = /^[a-z]+/.exec(rest)
    if (m) {
      const word = m[0]
      let j = 0
      while (j < word.length) {
        const w = word.slice(j)
        const fn = FUNCS.find((f) => w.startsWith(f))
        if (fn) { out.push({ k: 'fn', name: ALIAS[fn] ?? fn }); j += fn.length }
        else if (w.startsWith('pi')) { out.push({ k: 'const', name: 'pi' }); j += 2 }
        else if (w[0] === 'e') { out.push({ k: 'const', name: 'e' }); j += 1 }
        else { out.push({ k: 'id', name: w[0] }); j += 1 }
      }
      i += word.length
      continue
    }
    if ('+-*/^()'.includes(rest[0])) { out.push({ k: 'op', v: rest[0] }); i++; continue }
    throw new ParseError('badChar')
  }
  return out
}

class Parser {
  private pos = 0
  constructor(private toks: Token[]) {}

  parse(): Node {
    if (this.toks.length === 0) throw new ParseError('empty')
    const n = this.expr()
    if (this.pos < this.toks.length) throw new ParseError(this.isOp(')') ? 'parens' : 'syntax')
    return n
  }
  private peek(): Token | undefined { return this.toks[this.pos] }
  private isOp(v: string) { const t = this.peek(); return !!t && t.k === 'op' && t.v === v }
  private startsPrimary() {
    const t = this.peek()
    return !!t && (t.k === 'num' || t.k === 'id' || t.k === 'fn' || t.k === 'const' || (t.k === 'op' && t.v === '('))
  }
  private expr(): Node {
    let n = this.term()
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.pos++] as { v: '+' | '-' }).v
      n = { t: 'bin', op, a: n, b: this.term() }
    }
    return n
  }
  private term(): Node {
    let n = this.unary()
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.toks[this.pos++] as { v: '*' | '/' }).v
        n = { t: 'bin', op, a: n, b: this.unary() }
      } else if (this.startsPrimary()) {
        n = { t: 'bin', op: '*', a: n, b: this.power() } // nhân ngầm: 2x, x(x+1)
      } else return n
    }
  }
  private unary(): Node {
    if (this.isOp('-')) { this.pos++; return { t: 'neg', a: this.unary() } }
    if (this.isOp('+')) { this.pos++; return this.unary() }
    return this.power()
  }
  private power(): Node {
    const base = this.primary()
    if (this.isOp('^')) { this.pos++; return { t: 'bin', op: '^', a: base, b: this.unary() } }
    return base
  }
  private primary(): Node {
    const t = this.peek()
    if (!t) throw new ParseError('syntax')
    this.pos++
    if (t.k === 'num') return { t: 'num', v: t.v }
    if (t.k === 'const') return { t: 'const', name: t.name }
    if (t.k === 'id') return { t: 'var', name: t.name }
    if (t.k === 'fn') {
      // sin^2(x) = (sin x)^2
      let exp: Node | null = null
      if (this.isOp('^')) { this.pos++; exp = this.primary() }
      const arg = this.isOp('(') ? this.group() : this.power()
      const call: Node = { t: 'fn', name: t.name, a: arg }
      return exp ? { t: 'bin', op: '^', a: call, b: exp } : call
    }
    if (t.k === 'op' && t.v === '(') { this.pos--; return this.group() }
    throw new ParseError(t.k === 'op' && t.v === ')' ? 'parens' : 'syntax')
  }
  private group(): Node {
    this.pos++ // (
    const n = this.expr()
    if (!this.isOp(')')) throw new ParseError('parens')
    this.pos++
    return n
  }
}

export function parseExpression(src: string): Node {
  return new Parser(tokenize(normalize(src))).parse()
}

export function variables(n: Node, acc = new Set<string>()): Set<string> {
  if (n.t === 'var') acc.add(n.name)
  else if (n.t === 'neg' || n.t === 'fn') variables(n.a, acc)
  else if (n.t === 'bin') { variables(n.a, acc); variables(n.b, acc) }
  return acc
}

export type Scope = Record<string, number>
export type Compiled = (s: Scope) => number

const FN: Record<string, (v: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, cot: (v) => 1 / Math.tan(v),
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10,
}

export function compile(n: Node): Compiled {
  switch (n.t) {
    case 'num': { const v = n.v; return () => v }
    case 'const': { const v = n.name === 'pi' ? Math.PI : Math.E; return () => v }
    case 'var': { const k = n.name; return (s) => s[k] }
    case 'neg': { const a = compile(n.a); return (s) => -a(s) }
    case 'fn': { const a = compile(n.a), f = FN[n.name]; return (s) => f(a(s)) }
    case 'bin': {
      const a = compile(n.a), b = compile(n.b)
      switch (n.op) {
        case '+': return (s) => a(s) + b(s)
        case '-': return (s) => a(s) - b(s)
        case '*': return (s) => a(s) * b(s)
        case '/': return (s) => a(s) / b(s)
        default: return (s) => Math.pow(a(s), b(s))
      }
    }
  }
}

const TEX_FN: Record<string, string> = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', ln: '\\ln', log: '\\log',
}

const prec = (n: Node): number => (n.t === 'bin' ? (n.op === '+' || n.op === '-' ? 1 : n.op === '^' ? 4 : 2) : n.t === 'neg' ? 1.5 : 5)
const startsWithDigit = (n: Node): boolean =>
  n.t === 'num' || (n.t === 'bin' && n.op !== '^' && n.op !== '/' && startsWithDigit(n.a)) || (n.t === 'bin' && n.op === '^' && startsWithDigit(n.a))

/** Chuyển cây biểu thức sang LaTeX để KaTeX hiển thị. */
export function toTex(n: Node): string {
  const wrap = (c: Node, min: number) => (prec(c) < min ? `\\left(${toTex(c)}\\right)` : toTex(c))
  switch (n.t) {
    case 'num': return String(n.v).replace('.', '{,}') // dấu phẩy thập phân kiểu Việt Nam
    case 'const': return n.name === 'pi' ? '\\pi' : 'e'
    case 'var': return n.name
    case 'neg': return `-${wrap(n.a, 2)}`
    case 'fn':
      if (n.name === 'sqrt') return `\\sqrt{${toTex(n.a)}}`
      if (n.name === 'abs') return `\\left|${toTex(n.a)}\\right|`
      if (n.name === 'exp') return `e^{${toTex(n.a)}}`
      return `${TEX_FN[n.name]}\\left(${toTex(n.a)}\\right)`
    case 'bin':
      switch (n.op) {
        case '+': return `${toTex(n.a)} + ${toTex(n.b)}`
        case '-': return `${toTex(n.a)} - ${n.b.t === 'bin' && (n.b.op === '+' || n.b.op === '-') ? `\\left(${toTex(n.b)}\\right)` : toTex(n.b)}`
        case '/': return `\\frac{${toTex(n.a)}}{${toTex(n.b)}}`
        case '^': {
          const base = n.a.t === 'num' || n.a.t === 'var' || n.a.t === 'const' ? toTex(n.a) : `\\left(${toTex(n.a)}\\right)`
          return `${base}^{${toTex(n.b)}}`
        }
        default: {
          const l = wrap(n.a, 2), r = wrap(n.b, 2)
          return startsWithDigit(n.b) ? `${l} \\cdot ${r}` : `${l}${n.b.t === 'neg' ? ` \\cdot ${r}` : r}`
        }
      }
  }
}
