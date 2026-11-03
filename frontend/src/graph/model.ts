import { latexToExpr } from './latex'
import { ParseError, compile, normalize, parseExpression, toTex, variables, type ErrorCode, type Node, type Scope } from './expr'

export type Rel = '=' | '<' | '>' | '<=' | '>='

export type Model =
  | { ok: true; kind: 'function' | 'vertical' | 'xset'; rel: Rel; node: Node; params: string[]; tex: string; equation?: boolean }
  | { ok: false; error: ErrorCode }

const REL_TEX: Record<Rel, string> = { '=': '=', '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge' }

/**
 * Hiểu một dòng người dùng nhập:
 *  - "y = ...", "f(x) = ...", hoặc chỉ biểu thức (coi là y = ...)
 *  - "x = số" (đường thẳng đứng)
 *  - bất phương trình "y > ...", "y <= ..." (tô miền)
 */
export function analyse(input: string): Model {
  try {
    const raw = input.includes('\\') ? latexToExpr(input) : input
    if (!raw.trim()) return { ok: false, error: 'empty' }
    const found = [...raw.matchAll(/<=|>=|≤|≥|<|>|=/g)]
    if (found.length > 1) throw new ParseError('unsupported')
    let kind: 'function' | 'vertical' | 'xset' = 'function'
    let rel: Rel = '='
    let rhs = raw
    let equation = false
    let lhsText = ''
    if (found.length === 1) {
      const m = found[0]
      const op = m[0] === '≤' ? '<=' : m[0] === '≥' ? '>=' : (m[0] as Rel)
      rel = op
      const lhs = normalize(raw.slice(0, m.index))
      rhs = raw.slice((m.index ?? 0) + m[0].length)
      if (lhs === 'x') kind = 'vertical'
      else if (!/^(y|[a-z]\(x\))$/.test(lhs)) {
        // "A = B": vẽ y = A − B, nghiệm là giao Ox. Bất phương trình kiểu này chưa hỗ trợ.
        if (rel !== '=') kind = 'xset' // A > B theo x: tô các khoảng của trục x thoả f(x) = A − B lớn/nhỏ hơn 0
        equation = true
        lhsText = raw.slice(0, m.index)
      }
    }
    const right = parseExpression(rhs)
    const left = equation ? parseExpression(lhsText) : null
    const node: Node = left ? { t: 'bin', op: '-', a: left, b: right } : right
    const vars = variables(node)
    if (vars.has('y')) throw new ParseError('unsupported')
    if (kind === 'vertical' && vars.has('x')) throw new ParseError('unsupported')
    const params = [...vars].filter((v) => v !== 'x').sort()
    const tex = left ? `${toTex(left)} ${REL_TEX[rel]} ${toTex(right)}` : `${kind === 'vertical' ? 'x' : 'y'} ${REL_TEX[rel]} ${toTex(node)}`
    return { ok: true, kind, rel, node, params, tex, equation }
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.code }
    throw e
  }
}

export interface Evaluator {
  /** y = f(x). Với đường thẳng đứng thì luôn NaN. */
  f: (x: number) => number
  /** Hoành độ đường thẳng đứng x = c, hoặc null. */
  vertical: number | null
  rel: Rel
  /** true: bất phương trình theo x, f = A − B và miền nghiệm là các dải thẳng đứng. */
  xset?: boolean
}

export function makeEvaluator(model: Extract<Model, { ok: true }>, params: Record<string, number>): Evaluator {
  const run = compile(model.node)
  const scope: Scope = { x: 0 }
  for (const p of model.params) scope[p] = params[p] ?? 1
  if (model.kind === 'vertical') return { f: () => NaN, vertical: run(scope), rel: model.rel }
  return { f: (x) => { scope.x = x; return run(scope) }, vertical: null, rel: model.rel, xset: model.kind === 'xset' }
}
