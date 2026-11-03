import { useEffect, useRef, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  T,
  type Editor,
  type JsonValue,
  type TLBaseShape,
} from 'tldraw'
import { analyse, makeEvaluator } from './model'
import { findIntersections, findSpecialPoints, type SpecialPoint } from './analysis'
import { cardPalette, renderGraphSvg, type Curve } from './render'
import { PLOT_H, PLOT_W, zoomAt, type View } from './view'
import { DEFAULT_GRAPH_DISPLAY, type GraphDisplayOptions } from '../store/useGraphStore'

export interface GraphShapeData {
  exprs: string[]
  params: Record<string, number>
  view: View
  display: GraphDisplayOptions
  colors: string[]
}

export type GraphShape = TLBaseShape<'graph', {
  w: number
  h: number
  exprs: string[]
  params: JsonValue
  cx: number
  cy: number
  ppu: number
  xIntercepts: boolean
  yIntercepts: boolean
  extrema: boolean
  intersections: boolean
  colors: string[]
}>

export function graphDataFromShape(shape: GraphShape): GraphShapeData {
  const params: Record<string, number> = {}
  if (shape.props.params && typeof shape.props.params === 'object' && !Array.isArray(shape.props.params)) {
    for (const [name, value] of Object.entries(shape.props.params)) {
      if (typeof value === 'number' && Number.isFinite(value)) params[name] = value
    }
  }
  return {
    exprs: shape.props.exprs,
    params,
    view: { cx: shape.props.cx, cy: shape.props.cy, ppu: shape.props.ppu },
    display: {
      xIntercepts: shape.props.xIntercepts,
      yIntercepts: shape.props.yIntercepts,
      extrema: shape.props.extrema,
      intersections: shape.props.intersections,
    },
    colors: shape.props.colors,
  }
}

export function graphDataToProps(data: GraphShapeData): Partial<GraphShape['props']> {
  return {
    exprs: data.exprs,
    params: data.params,
    cx: data.view.cx,
    cy: data.view.cy,
    ppu: data.view.ppu,
    xIntercepts: data.display.xIntercepts,
    yIntercepts: data.display.yIntercepts,
    extrema: data.display.extrema,
    intersections: data.display.intersections,
    colors: data.colors,
  }
}

function getCurves(data: GraphShapeData): Curve[] {
  return data.exprs.flatMap((expr, ci) => {
    const model = analyse(expr)
    if (!model.ok) return []
    const evaluator = makeEvaluator(model, data.params)
    return [{ ...evaluator, ci }]
  })
}

function makeSvg(data: GraphShapeData, w: number, h: number, stretch = true): string {
  const curves = getCurves(data)
  const scale = w / PLOT_W
  const view = { ...data.view, ppu: data.view.ppu * scale }
  const x0 = view.cx - w / 2 / view.ppu
  const x1 = view.cx + w / 2 / view.ppu
  const needsSpecial = data.display.xIntercepts || data.display.yIntercepts || data.display.extrema
  const special: SpecialPoint[][] = needsSpecial
    ? curves.map((curve) => curve.vertical === null ? findSpecialPoints(curve.f, x0, x1) : [])
    : curves.map(() => [])
  const intersections: { x: number; y: number }[] = []
  if (data.display.intersections) {
    for (let i = 0; i < curves.length; i++) for (let j = i + 1; j < curves.length; j++) {
      const a = curves[i], b = curves[j]
      if (a.xset || b.xset) continue
      if (a.vertical === null && b.vertical === null) intersections.push(...findIntersections(a.f, b.f, x0, x1))
      else if (a.vertical !== null && b.vertical === null) intersections.push({ x: a.vertical, y: b.f(a.vertical) })
      else if (a.vertical === null && b.vertical !== null) intersections.push({ x: b.vertical, y: a.f(b.vertical) })
    }
  }
  const markers = [
    ...(data.display.xIntercepts ? special.flatMap((points) => points.filter((p) => p.kind === 'xint')) : []),
    ...(data.display.yIntercepts ? special.flatMap((points) => points.filter((p) => p.kind === 'yint')) : []),
    ...(data.display.extrema ? special.flatMap((points) => points.filter((p) => p.kind === 'max' || p.kind === 'min')) : []),
    ...intersections.filter((point) => Number.isFinite(point.y)),
  ]
  const colors = data.colors.map((color, i) =>
    /^#[\da-f]{6}$/i.test(color) ? color : cardPalette.curves[i % cardPalette.curves.length]
  )
  return renderGraphSvg({
    w, h, view, curves, points: markers, palette: { ...cardPalette, curves: colors.length ? colors : cardPalette.curves }, stretch,
  })
}

function GraphShapeView({ shape, editor }: { shape: GraphShape; editor: Editor }) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const currentView = useRef<View>({ cx: shape.props.cx, cy: shape.props.cy, ppu: shape.props.ppu * (shape.props.w / PLOT_W) })
  const scale = shape.props.w / PLOT_W
  const view = { cx: shape.props.cx, cy: shape.props.cy, ppu: shape.props.ppu * scale }
  currentView.current = view

  const updateView = (next: View) => {
    currentView.current = next
    editor.updateShape<GraphShape>({
      id: shape.id,
      type: 'graph',
      props: { cx: next.cx, cy: next.cy, ppu: next.ppu / scale },
    })
  }

  const localPoint = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - bounds.left) * shape.props.w) / bounds.width,
      y: ((event.clientY - bounds.top) * shape.props.h) / bounds.height,
    }
  }

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const container = containerRef.current
      if (!container || !event.composedPath().includes(container)) return
      event.preventDefault()
      event.stopPropagation()
      const bounds = container.getBoundingClientRect()
      const point = {
        x: ((event.clientX - bounds.left) * shape.props.w) / bounds.width,
        y: ((event.clientY - bounds.top) * shape.props.h) / bounds.height,
      }
      updateView(zoomAt(currentView.current, point.x, point.y, Math.exp(-event.deltaY * 0.0015), shape.props.w, shape.props.h))
    }
    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => window.removeEventListener('wheel', onWheel, { capture: true })
  }, [editor, shape.id, shape.props.w, shape.props.h, scale])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 1 && !event.altKey) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = localPoint(event)
    drag.current = { pointerId: event.pointerId, ...point }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const last = drag.current
    if (!last || last.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const point = localPoint(event)
    const current = currentView.current
    updateView({
      ...current,
      cx: current.cx - (point.x - last.x) / current.ppu,
      cy: current.cy + (point.y - last.y) / current.ppu,
    })
    drag.current = { pointerId: event.pointerId, ...point }
  }

  const stopPan = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    event.stopPropagation()
    drag.current = null
  }

  const data = graphDataFromShape(shape)
  const svg = makeSvg(data, shape.props.w, shape.props.h)

  return (
    <HTMLContainer
      className="overflow-hidden rounded-xl border border-[#dfe6e2] bg-white"
      style={{ width: '100%', height: '100%', touchAction: 'none', pointerEvents: 'all' }}
      title={t('graph.boardHint')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopPan}
      onPointerCancel={stopPan}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />
    </HTMLContainer>
  )
}

export class GraphShapeUtil extends BaseBoxShapeUtil<GraphShape> {
  static override type = 'graph'
  static override props = {
    w: T.number,
    h: T.number,
    exprs: T.arrayOf(T.string),
    params: T.jsonValue,
    cx: T.number,
    cy: T.number,
    ppu: T.number,
    xIntercepts: T.boolean,
    yIntercepts: T.boolean,
    extrema: T.boolean,
    intersections: T.boolean,
    colors: T.arrayOf(T.string),
  }

  override getDefaultProps(): GraphShape['props'] {
    return {
      w: PLOT_W,
      h: PLOT_H,
      exprs: [],
      params: {},
      cx: 0,
      cy: 0,
      ppu: 30,
      xIntercepts: DEFAULT_GRAPH_DISPLAY.xIntercepts,
      yIntercepts: DEFAULT_GRAPH_DISPLAY.yIntercepts,
      extrema: DEFAULT_GRAPH_DISPLAY.extrema,
      intersections: DEFAULT_GRAPH_DISPLAY.intersections,
      colors: cardPalette.curves,
    }
  }

  override getGeometry(shape: GraphShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override component(shape: GraphShape) {
    return <GraphShapeView shape={shape} editor={this.editor} />
  }

  override indicator(shape: GraphShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} />
  }

  override toSvg(shape: GraphShape) {
    const data = graphDataFromShape(shape)
    return <g dangerouslySetInnerHTML={{ __html: makeSvg(data, shape.props.w, shape.props.h, false) }} />
  }

  override canResize() {
    return true
  }
}
