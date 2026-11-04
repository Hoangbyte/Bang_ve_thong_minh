import {
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultSizeStyle,
  StateNode,
  createShapeId,
  type TLGeoShape,
  type TLKeyboardEventInfo,
  type TLLineShape,
  type TLPointerEventInfo,
  type TLShapeId,
} from 'tldraw'

export interface GeometryEdgeRef {
  startVertexId: TLShapeId
  endVertexId: TLShapeId
  preview?: boolean
}

export function getGeometryEdge(shape: { meta: Record<string, unknown> }): GeometryEdgeRef | null {
  const edge = shape.meta.geometryEdge
  if (!edge || typeof edge !== 'object') return null
  const value = edge as Record<string, unknown>
  return typeof value.startVertexId === 'string' && typeof value.endVertexId === 'string'
    ? {
        startVertexId: value.startVertexId as TLShapeId,
        endVertexId: value.endVertexId as TLShapeId,
        preview: value.preview === true,
      }
    : null
}

export function isGeometryVertex(shape: { meta: Record<string, unknown> }): boolean {
  return shape.meta.geometryVertex === true
}

export function isGeometryPreview(shape: { meta: Record<string, unknown> }): boolean {
  return shape.meta.geometryPreview === true
}

export function geometryVertexCenter(shape: TLGeoShape) {
  return { x: shape.x + shape.props.w / 2, y: shape.y + shape.props.h / 2 }
}

export function setLineEndpoints(
  editor: StateNode['editor'],
  id: TLShapeId,
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const line = editor.getShape<TLLineShape>(id)
  if (!line || line.type !== 'line') return
  const keys = Object.keys(line.props.points)
  if (keys.length < 2) return
  const startKey = keys[0]
  const endKey = keys[keys.length - 1]
  const points = { ...line.props.points }
  points[startKey] = { ...points[startKey], x: 0, y: 0 }
  points[endKey] = { ...points[endKey], x: end.x - start.x, y: end.y - start.y }
  editor.updateShape<TLLineShape>({
    id,
    type: 'line',
    x: start.x,
    y: start.y,
    props: { points },
  })
}

type SharedStyle<T> = { type: 'shared'; value: T } | { type: 'mixed' } | undefined

function sharedValue<T>(value: SharedStyle<T>, fallback: T): T {
  return value?.type === 'shared' ? value.value : fallback
}

export class PointLineTool extends StateNode {
  static override id = 'point-line'
  static override isLockable = false

  private startId: TLShapeId | null = null
  private startPoint: { x: number; y: number } | null = null
  private startScreen: { x: number; y: number } | null = null
  private previewEdgeId: TLShapeId | null = null
  private previewVertexId: TLShapeId | null = null
  private snappedVertexId: TLShapeId | null = null
  private cursorPoint: { x: number; y: number } | null = null

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onExit() {
    this.clearPreview()
    this.resetGesture()
  }

  override onPointerDown(info: TLPointerEventInfo) {
    if (info.button !== 0) return
    const point = this.editor.inputs.currentPagePoint
    const screen = this.editor.pageToViewport(point)
    const nearby = this.findNearbyVertex(point)
    const existing = nearby?.id ?? null

    this.editor.markHistoryStoppingPoint('point-line-segment')
    if (existing) {
      const shape = this.editor.getShape<TLGeoShape>(existing)
      if (!shape || shape.type !== 'geo') return
      this.startId = existing
      this.startPoint = geometryVertexCenter(shape)
    } else {
      this.startPoint = { x: point.x, y: point.y }
      this.startId = this.createVertex(point, false)
    }

    this.startScreen = { x: screen.x, y: screen.y }
    this.cursorPoint = { ...this.startPoint }
    this.snappedVertexId = null
  }

  override onPointerMove() {
    if (!this.startId || !this.startPoint || !this.startScreen) return
    const point = this.editor.inputs.currentPagePoint
    const screen = this.editor.pageToViewport(point)
    if (Math.hypot(screen.x - this.startScreen.x, screen.y - this.startScreen.y) < 3) return
    this.updatePreview(point)
  }

  override onPointerUp() {
    if (!this.startId || !this.startPoint || !this.startScreen) return
    const point = this.editor.inputs.currentPagePoint
    const screen = this.editor.pageToViewport(point)
    const distance = Math.hypot(screen.x - this.startScreen.x, screen.y - this.startScreen.y)
    if (distance < 3) {
      this.clearPreview()
      this.editor.markHistoryStoppingPoint('point-line-point')
      this.resetGesture(false)
      return
    }

    this.updatePreview(point)
    if (!this.previewEdgeId || !this.previewVertexId) {
      this.resetGesture(false)
      return
    }

    const endId = this.snappedVertexId ?? this.previewVertexId
    if (endId === this.startId) {
      this.clearPreview()
      this.resetGesture(false)
      return
    }

    const end = this.getVertexCenter(endId)
    if (!end) {
      this.clearPreview()
      this.resetGesture(false)
      return
    }

    const edge = this.editor.getShape<TLLineShape>(this.previewEdgeId)
    if (!edge || edge.type !== 'line') {
      this.clearPreview()
      this.resetGesture(false)
      return
    }

    this.editor.run(() => {
      setLineEndpoints(this.editor, edge.id, this.startPoint!, end)
      this.editor.updateShape<TLLineShape>({
        id: edge.id,
        type: 'line',
        meta: { geometryEdge: { startVertexId: this.startId!, endVertexId: endId } },
        props: { dash: this.getDash(), color: this.getColor(), size: this.getSize() },
      })
      if (this.snappedVertexId) this.editor.deleteShape(this.previewVertexId!)
      else {
        this.editor.updateShape<TLGeoShape>({
          id: this.previewVertexId!,
          type: 'geo',
          meta: { geometryVertex: true },
          props: { color: this.getColor(), dash: 'solid', fill: 'solid' },
        })
      }
      this.editor.bringToFront([this.startId!, endId])
    })

    this.editor.markHistoryStoppingPoint('point-line-complete')
    this.startId = endId
    this.startPoint = end
    this.previewEdgeId = null
    this.previewVertexId = null
    this.snappedVertexId = null
    this.startScreen = null
    this.cursorPoint = null
  }

  override onCancel() {
    this.clearPreview()
    this.resetGesture()
    this.editor.updateInstanceState({ isToolLocked: false })
    this.editor.setCurrentTool('select')
  }

  override onKeyDown(info: TLKeyboardEventInfo) {
    if (info.code === 'Escape') this.onCancel()
  }

  private findNearbyVertex(point: { x: number; y: number }) {
    const screen = this.editor.pageToViewport(point)
    const radius = 14
    let nearest: { id: TLShapeId; distance: number } | null = null
    for (const shape of this.editor.getCurrentPageShapes()) {
      if (shape.type !== 'geo') continue
      const vertex = this.editor.getShape<TLGeoShape>(shape.id)
      if (!vertex || !isGeometryVertex(vertex) || isGeometryPreview(vertex)) continue
      const center = geometryVertexCenter(vertex)
      const location = this.editor.pageToViewport(center)
      const distance = Math.hypot(location.x - screen.x, location.y - screen.y)
      if (distance <= radius && (!nearest || distance < nearest.distance)) nearest = { id: shape.id, distance }
    }
    return nearest
  }

  private getVertexCenter(id: TLShapeId) {
    const shape = this.editor.getShape<TLGeoShape>(id)
    return shape?.type === 'geo' ? geometryVertexCenter(shape) : null
  }

  private createVertex(point: { x: number; y: number }, preview: boolean) {
    const id = createShapeId()
    const diameter = (preview ? 16 : 12) / this.editor.getZoomLevel()
    this.editor.createShape<TLGeoShape>({
      id,
      type: 'geo',
      x: point.x - diameter / 2,
      y: point.y - diameter / 2,
      meta: { geometryVertex: true, ...(preview ? { geometryPreview: true } : {}) },
      props: {
        w: diameter,
        h: diameter,
        geo: 'ellipse',
        color: preview ? 'blue' : this.getColor(),
        fill: preview ? 'semi' : 'solid',
        dash: preview ? 'dashed' : 'solid',
        size: 'm',
      },
    })
    return id
  }

  private updatePreview(point: { x: number; y: number }) {
    if (!this.startId || !this.startPoint) return
    const nearby = this.findNearbyVertex(point)
    const endId = nearby?.id ?? null
    const end = endId ? this.getVertexCenter(endId) : point
    if (!end) return
    this.cursorPoint = end
    this.snappedVertexId = endId

    if (!this.previewVertexId) this.previewVertexId = this.createVertex(end, true)
    else {
      const diameter = 16 / this.editor.getZoomLevel()
      this.editor.updateShape<TLGeoShape>({
        id: this.previewVertexId,
        type: 'geo',
        x: end.x - diameter / 2,
        y: end.y - diameter / 2,
        meta: { geometryVertex: true, geometryPreview: true },
        props: {
          w: diameter,
          h: diameter,
          color: endId ? 'green' : 'blue',
          fill: 'semi',
          dash: endId ? 'solid' : 'dashed',
        },
      })
    }

    if (!this.previewEdgeId) {
      this.previewEdgeId = createShapeId()
      this.editor.createShape<TLLineShape>({
        id: this.previewEdgeId,
        type: 'line',
        x: this.startPoint.x,
        y: this.startPoint.y,
        meta: { geometryEdge: { startVertexId: this.startId, endVertexId: this.previewVertexId, preview: true } },
        props: { dash: 'dotted', color: 'blue', size: 'm' },
      })
    }
    setLineEndpoints(this.editor, this.previewEdgeId, this.startPoint, end)
    this.editor.updateShape<TLLineShape>({
      id: this.previewEdgeId,
      type: 'line',
      meta: { geometryEdge: { startVertexId: this.startId, endVertexId: this.previewVertexId, preview: true } },
    })
  }

  private getColor() {
    return sharedValue(this.editor.getSharedStyles().get(DefaultColorStyle), 'black')
  }

  private getDash() {
    const dash = sharedValue(this.editor.getSharedStyles().get(DefaultDashStyle), 'solid')
    return dash === 'draw' ? 'solid' : dash
  }

  private getSize() {
    return sharedValue(this.editor.getSharedStyles().get(DefaultSizeStyle), 'm')
  }

  private clearPreview() {
    const ids = [this.previewEdgeId, this.previewVertexId].filter((id): id is TLShapeId => !!id)
    if (ids.length) this.editor.deleteShapes(ids)
    this.previewEdgeId = null
    this.previewVertexId = null
    this.snappedVertexId = null
  }

  private resetGesture(clearChain = true) {
    this.clearPreview()
    this.startScreen = null
    this.cursorPoint = null
    if (clearChain) {
      this.startId = null
      this.startPoint = null
    }
  }
}
