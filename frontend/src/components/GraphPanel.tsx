import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { ImagePlus, Maximize, Plus, X, ZoomIn, ZoomOut } from 'lucide-react'
import { DEFAULT_GRAPH_DISPLAY, MAX_EXPRS, useGraphStore } from '../store/useGraphStore'
import { useEditorStore, useEditorValue } from '../store/useEditorStore'
// Nạp MathLive khi mở tab Đồ thị (tách gói riêng)
const FormulaEditor = lazy(() => import('./FormulaEditor').then((m) => ({ default: m.FormulaEditor })))
import { analyse, makeEvaluator } from '../graph/model'
import { findIntersections, findSpecialPoints, type SpecialPoint } from '../graph/analysis'
import { PLOT_H, PLOT_W, fitView, zoomAt, type View } from '../graph/view'
import { cardPalette, livePalette, renderGraphSvg, type Curve } from '../graph/render'
import { dropGraphToBoard, updateGraphOnBoard } from '../graph/dropToBoard'
import { graphDataFromShape, type GraphShape, type GraphShapeData } from '../graph/GraphShape'
import type { TLShapeId } from 'tldraw'
import { niceNumber, quadraticExact } from '../graph/nice'
import { fmt } from '../graph/format'
import { IconButton } from './ui'

const EXAMPLES: { id: string; rows: string[] }[] = [
  { id: 'quad', rows: ['y = x² - 4x + 3'] },
  { id: 'cubic', rows: ['y = x³ - 3x'] },
  { id: 'param', rows: ['y = ax² + bx + c'] },
  { id: 'sin', rows: ['y = 2sin(x)'] },
  { id: 'system', rows: ['y = x² - 4', 'y = x - 2'] },
  { id: 'ineq', rows: ['y >= x² - 4', 'y < 2'] },
  { id: 'xineq', rows: ['x² - 4 > 0'] },
]
const GROUPS = ['yint', 'xint', 'max', 'min'] as const
const DEFAULT_VIEW: View = { cx: 0, cy: 0, ppu: 30 }
type Pt = { x: number; y: number }
type GraphSelection = { id: TLShapeId; data: GraphShapeData }

function readLegacyGraph(id: TLShapeId, metadata: unknown): GraphSelection | null {
  if (!metadata || typeof metadata !== 'object') return null
  const graph = (metadata as Record<string, unknown>).graph
  if (!graph || typeof graph !== 'object') return null
  const meta = graph as Record<string, unknown>
  if (!Array.isArray(meta.exprs) || !meta.exprs.every((expr) => typeof expr === 'string')) return null
  const params: Record<string, number> = {}
  if (meta.params && typeof meta.params === 'object' && !Array.isArray(meta.params)) {
    for (const [name, value] of Object.entries(meta.params)) {
      if (typeof value === 'number' && Number.isFinite(value)) params[name] = value
    }
  }
  return {
    id,
    data: {
      exprs: meta.exprs,
      params,
      view: DEFAULT_VIEW,
      display: DEFAULT_GRAPH_DISPLAY,
      colors: cardPalette.curves,
    },
  }
}

/**
 * Tab "Đồ thị": nhập một hoặc nhiều phương trình/bất phương trình, xem công thức (KaTeX),
 * đồ thị Oxy, điểm đặc biệt, giao điểm, thanh trượt tham số, và thả lên bảng.
 */
export function GraphPanel() {
  const { t } = useTranslation()
  const {
    exprs, params, view, display, fitFor, setExpr, setExprs, addExpr, removeExpr,
    setParam, setView, setDisplay, markFit,
  } = useGraphStore()
  const editor = useEditorStore((s) => s.editor)
  const plotRef = useRef<HTMLDivElement>(null)
  const [dropped, setDropped] = useState(false)
  const sel = useEditorValue<GraphSelection | null>('graphSel', (e) => {
    const shape = e.getOnlySelectedShape()
    if (!shape) return null
    if (shape.type === 'graph') {
      const graph = graphDataFromShape(shape as GraphShape)
      return { id: shape.id, data: graph }
    }
    if (shape.type === 'image') return readLegacyGraph(shape.id, shape.meta)
    return null
  }, null)
  const loadSel = () => {
    if (!sel) return
    setExprs(sel.data.exprs)
    Object.entries(sel.data.params).forEach(([name, value]) => setParam(name, value))
    ;(Object.keys(DEFAULT_GRAPH_DISPLAY) as (keyof typeof DEFAULT_GRAPH_DISPLAY)[]).forEach((key) => setDisplay(key, sel.data.display[key]))
    setView(sel.data.view)
    markFit(sel.data.exprs.join('\n'))
  }
  const drawLatex = (latex: string) => {
    const i = exprs.findIndex((e) => !e.trim())
    if (i >= 0) return setExpr(i, latex) // còn dòng trống thì dùng
    if (exprs.length < MAX_EXPRS) return setExprs([...exprs, latex]) // chưa đủ dòng thì thêm
    if (window.confirm(t('graph.overwriteLast'))) setExpr(exprs.length - 1, latex) // đủ dòng mới hỏi ghi đè
  }
  const [msgKey, setMsgKey] = useState<'dropped' | 'updated'>('dropped')

  const models = useMemo(() => exprs.map(analyse), [exprs])
  const paramNames = useMemo(() => [...new Set(models.flatMap((m) => (m.ok ? m.params : [])))].sort(), [models])
  // Giá trị tham số đang dùng (mặc định 1 cho tham số chưa chỉnh)
  const values = useMemo(() => Object.fromEntries(paramNames.map((n) => [n, params[n] ?? 1])), [paramNames, params])
  const evs = useMemo(() => models.map((m) => (m.ok ? makeEvaluator(m, values) : null)), [models, values])
  const v = view ?? DEFAULT_VIEW
  const key = exprs.join('\n')

  // Đổi phương trình thì chọn lại khung nhìn vừa khung (kéo thanh trượt thì giữ nguyên khung)
  useEffect(() => {
    if (fitFor === key) return
    const items = evs.flatMap((e) => (e ? [{ f: e.f, vertical: e.vertical }] : []))
    if (items.length) {
      setView(fitView(items))
      markFit(key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const x0 = v.cx - PLOT_W / 2 / v.ppu
  const x1 = v.cx + PLOT_W / 2 / v.ppu
  const { rows, inter } = useMemo(() => {
    const showCurvePoints = display.xIntercepts || display.yIntercepts || display.extrema
    const rows: SpecialPoint[][] = showCurvePoints
      ? evs.map((e) => (e && e.vertical === null ? findSpecialPoints(e.f, x0, x1) : []))
      : evs.map(() => [])
    const inter: Pt[] = []
    if (display.intersections) for (let i = 0; i < evs.length; i++) for (let j = i + 1; j < evs.length; j++) {
      const a = evs[i], b = evs[j]
      if (!a || !b || a.xset || b.xset) continue
      if (a.vertical === null && b.vertical === null) inter.push(...findIntersections(a.f, b.f, x0, x1))
      else if (a.vertical !== null && b.vertical === null) inter.push({ x: a.vertical, y: b.f(a.vertical) })
      else if (a.vertical === null && b.vertical !== null) inter.push({ x: b.vertical, y: a.f(b.vertical) })
    }
    return { rows, inter: inter.filter((p) => Number.isFinite(p.y)) }
  }, [evs, x0, x1, display])

  const curves: Curve[] = useMemo(
    () => evs.flatMap((e, ci) => (e ? [{ f: e.f, vertical: e.vertical, rel: e.rel, xset: e.xset, ci }] : [])),
    [evs]
  )
  const shownRows = useMemo(
    () => rows.map((row) => row.filter((p) => (
      (p.kind === 'xint' && display.xIntercepts) ||
      (p.kind === 'yint' && display.yIntercepts) ||
      ((p.kind === 'max' || p.kind === 'min') && display.extrema)
    ))),
    [rows, display]
  )
  const shownInter = display.intersections ? inter : []
  const points: Pt[] = useMemo(() => [...shownInter, ...shownRows.flat()], [shownInter, shownRows])

  const svg = useMemo(
    () => renderGraphSvg({ w: PLOT_W, h: PLOT_H, view: v, curves, points, palette: livePalette, responsive: true }),
    [v, curves, points]
  )

  // Kéo để di chuyển, cuộn để phóng to (đăng ký bộ nghe gốc để chặn cuộn trang)
  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    let last: Pt | null = null
    const local = (ev: MouseEvent) => {
      const r = el.getBoundingClientRect()
      return { x: ((ev.clientX - r.left) * PLOT_W) / r.width, y: ((ev.clientY - r.top) * PLOT_H) / r.height }
    }
    // Gom cập nhật khung nhìn theo khung hình để kéo/phóng không dựng lại SVG quá dày
    let raf = 0
    let pending: View | null = null
    const cur = () => pending ?? useGraphStore.getState().view
    const push = (nv: View) => { pending = nv; if (!raf) raf = requestAnimationFrame(() => { raf = 0; const p = pending; pending = null; if (p) setView(p) }) }
    const down = (e: PointerEvent) => { el.setPointerCapture(e.pointerId); last = local(e) }
    const move = (e: PointerEvent) => {
      const view = cur()
      if (!last || !view) return
      const p = local(e)
      push({ ...view, cx: view.cx - (p.x - last.x) / view.ppu, cy: view.cy + (p.y - last.y) / view.ppu })
      last = p
    }
    const up = () => { last = null }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e)
      push(zoomAt(cur() ?? DEFAULT_VIEW, p.x, p.y, Math.exp(-e.deltaY * 0.0015)))
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [setView])

  useEffect(() => {
    if (!dropped) return
    const timer = setTimeout(() => setDropped(false), 3000)
    return () => clearTimeout(timer)
  }, [dropped])

  const graphData = (): GraphShapeData => ({
    exprs: exprs.map((expr) => expr.trim()).filter(Boolean),
    params: values,
    view: v,
    display,
    colors: cardPalette.curves,
  })
  const drop = () => {
    if (!editor || curves.length === 0) return
    dropGraphToBoard(editor, graphData())
    setMsgKey('dropped')
    setDropped(true)
  }
  const updateSel = () => {
    if (!editor || !sel || curves.length === 0) return
    if (updateGraphOnBoard(editor, sel.id, graphData())) { setMsgKey('updated'); setDropped(true) }
  }

  const multi = exprs.length > 1
  const hasPoints = points.length > 0
  const toggleDisplay = (key: keyof typeof DEFAULT_GRAPH_DISPLAY) => {
    const next = { ...display, [key]: !display[key] }
    setDisplay(key, next[key])
    if (editor && sel) updateGraphOnBoard(editor, sel.id, { ...sel.data, display: next })
  }
  // Nghiệm đúng của các đường bậc 2 (vd 1 ± √2) thay cho số thập phân
  const exact = curves.flatMap((c) => (c.vertical === null ? quadraticExact(c.f) : []))
  const pt = (p: Pt) => `(${niceNumber(p.x, exact)}; ${niceNumber(p.y)})`

  return (
    <div className="space-y-4">
      <section aria-labelledby="g-label">
        <h2 id="g-label" className="mb-1.5 text-sm font-semibold text-ink">{t('graph.label')}</h2>
        <div className="space-y-2">
          {exprs.map((expr, i) => {
            const m = models[i]
            const error = !m.ok && m.error !== 'empty' ? t(`graph.errors.${m.error}`) : null
            return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: livePalette.curves[i] }} aria-hidden="true" />
                  <input
                    value={expr}
                    onChange={(e) => setExpr(i, e.target.value)}
                    placeholder={t('graph.placeholder')}
                    aria-label={t('graph.line', { n: i + 1 })}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    aria-invalid={!!error}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 font-mono text-sm text-ink"
                  />
                  {multi && <IconButton icon={X} label={t('graph.remove', { n: i + 1 })} onClick={() => removeExpr(i)} />}
                </div>
                <div role="status" className="min-h-[1.5rem] pl-5 text-sm">
                  {error ? (
                    <p style={{ color: 'var(--danger)' }}>{error}</p>
                  ) : m.ok ? (
                    <div className="overflow-x-auto py-0.5 text-ink" dangerouslySetInnerHTML={{ __html: katex.renderToString(m.tex, { throwOnError: false }) }} />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {EXAMPLES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setExprs(x.rows)}
              className="h-9 rounded-full border border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
            >
              {t(`graph.examples.${x.id}`)}
            </button>
          ))}
          {exprs.length < MAX_EXPRS && (
            <button
              type="button"
              onClick={addExpr}
              className="flex h-9 items-center gap-1 rounded-full border border-dashed border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
            >
              <Plus size={14} aria-hidden="true" />
              {t('graph.add')}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">{t('graph.hint')}</p>
      </section>

      <Suspense fallback={<div className="h-24" aria-busy="true" />}>
        <FormulaEditor onDraw={drawLatex} />
      </Suspense>

      {sel && (
        <div className="flex gap-2">
          <button type="button" onClick={loadSel} className="flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink hover:bg-hover">{t('graph.editSel')}</button>
          <button type="button" onClick={updateSel} disabled={curves.length === 0} className="flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink hover:bg-hover disabled:opacity-40">{t('graph.updateSel')}</button>
        </div>
      )}

      <section>
        <div
          ref={plotRef}
          className="cursor-grab touch-none select-none overflow-hidden rounded-xl border border-line active:cursor-grabbing"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-xs text-muted">{t('graph.plotHint')}</p>
          <div className="flex shrink-0">
            <IconButton icon={ZoomOut} label={t('zoom.out')} onClick={() => setView(zoomAt(v, PLOT_W / 2, PLOT_H / 2, 1 / 1.25))} />
            <IconButton icon={ZoomIn} label={t('zoom.in')} onClick={() => setView(zoomAt(v, PLOT_W / 2, PLOT_H / 2, 1.25))} />
            <IconButton
              icon={Maximize}
              label={t('zoom.fit')}
              disabled={curves.length === 0}
              onClick={() => setView(fitView(evs.flatMap((e) => (e ? [{ f: e.f, vertical: e.vertical }] : []))))}
            />
          </div>
        </div>
      </section>

      {paramNames.length > 0 && (
        <section aria-labelledby="g-params">
          <h2 id="g-params" className="mb-1 text-sm font-semibold text-ink">{t('graph.params')}</h2>
          {paramNames.map((name) => (
            <label key={name} className="flex items-center gap-3 py-1 text-sm text-ink">
              <span className="w-20 shrink-0 font-mono tabular-nums">{name} = {fmt(values[name])}</span>
              <input
                type="range" min={-10} max={10} step={0.1}
                value={values[name]}
                onChange={(e) => setParam(name, Number(e.target.value))}
                aria-label={name}
                className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
              />
            </label>
          ))}
        </section>
      )}

      {curves.length > 0 && (
        <section aria-labelledby="g-special">
          <h2 id="g-special" className="mb-1 text-sm font-semibold text-ink">{t('graph.special')}</h2>
          <div className="mb-3 grid grid-cols-2 gap-1">
            {([
              ['xIntercepts', t('graph.options.xIntercepts')],
              ['yIntercepts', t('graph.options.yIntercepts')],
              ['extrema', t('graph.options.extrema')],
              ['intersections', t('graph.options.intersections')],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={display[key]}
                onClick={() => toggleDisplay(key)}
                className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-2 text-left text-xs text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
              >
                {label}
                <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${display[key] ? 'bg-accent' : 'bg-line'}`} aria-hidden="true">
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-all motion-reduce:transition-none ${display[key] ? 'left-[1.125rem]' : 'left-0.5'}`} />
                </span>
              </button>
            ))}
          </div>
          {hasPoints ? (
            <dl className="space-y-2 text-sm">
              {shownInter.length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">{t('graph.inter')}</dt>
                  <dd className="font-mono tabular-nums text-ink">{shownInter.map((p) => pt(p)).join('  ')}</dd>
                </div>
              )}
              {shownRows.map((pts, i) => {
                const groups = GROUPS.map((k) => [k, pts.filter((p) => p.kind === k)] as const).filter(([, g]) => g.length)
                if (!groups.length) return null
                return (
                  <div key={i}>
                    {multi && (
                      <p className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: livePalette.curves[i] }} aria-hidden="true" />
                        {t('graph.line', { n: i + 1 })}
                      </p>
                    )}
                    {groups.map(([k, g]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="w-20 shrink-0 text-muted">{t(`graph.${k}`)}</dt>
                        <dd className="font-mono tabular-nums text-ink">{g.map((p) => pt(p)).join('  ')}</dd>
                      </div>
                    ))}
                  </div>
                )
              })}
            </dl>
          ) : (
            <p className="text-xs text-muted">
              {Object.values(display).some(Boolean) ? t('graph.noSpecial') : t('graph.hiddenSpecial')}
            </p>
          )}
        </section>
      )}

      <div>
        <button
          type="button"
          disabled={curves.length === 0}
          onClick={drop}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-on-accent transition-opacity disabled:opacity-40 motion-reduce:transition-none"
        >
          <ImagePlus size={18} aria-hidden="true" />
          {t('graph.drop')}
        </button>
        <p role="status" className="mt-1.5 min-h-[1.25rem] text-center text-xs text-muted">{dropped ? t(`graph.${msgKey}`) : ''}</p>
      </div>
    </div>
  )
}
