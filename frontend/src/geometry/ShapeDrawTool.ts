import {
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultSizeStyle,
  StateNode,
  createShapeId,
  type TLArrowShape,
  type TLGeoShape,
  type TLPointerEventInfo,
  type TLShapeId,
} from 'tldraw'

export type GeometryDrawMode = 'vector' | 'line' | 'dashed-line' | 'circle' | 'ellipse'

let drawingMode: GeometryDrawMode = 'vector'

export function setGeometryDrawMode(mode: GeometryDrawMode) {
  drawingMode = mode
}

export class ShapeDrawTool extends StateNode {
  static override id = 'geometry-draw'
  static override isLockable = false

  private shapeId: TLShapeId | null = null
  private start: { x: number; y: number } | null = null
  private mode: GeometryDrawMode = 'vector'

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onExit() {
    this.removeIncompleteShape()
  }

  override onPointerDown(info: TLPointerEventInfo) {
    if (info.button !== 0 || this.shapeId) return

    this.mode = drawingMode
    this.start = { ...this.editor.inputs.currentPagePoint }
    this.shapeId = createShapeId()
    this.editor.markHistoryStoppingPoint('geometry-shape-start')

    if (this.mode === 'vector' || this.mode === 'line' || this.mode === 'dashed-line') {
      const arrowheadEnd = this.mode === 'vector' ? 'arrow' : 'none'
      this.editor.createShape<TLArrowShape>({
        id: this.shapeId,
        type: 'arrow',
        x: this.start.x,
        y: this.start.y,
        props: {
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          arrowheadStart: 'none',
          arrowheadEnd,
          dash: this.mode === 'dashed-line' ? 'dashed' : this.getDash(),
          color: this.getColor(),
          size: this.getSize(),
        },
      })
    } else {
      const centerBased = this.mode === 'circle'
      this.editor.createShape<TLGeoShape>({
        id: this.shapeId,
        type: 'geo',
        x: centerBased ? this.start.x - 0.5 : this.start.x,
        y: centerBased ? this.start.y - 0.5 : this.start.y,
        meta: centerBased ? { geometryCircle: true } : {},
        props: {
          geo: 'ellipse',
          w: 1,
          h: 1,
          color: this.getColor(),
          size: this.getSize(),
          dash: this.getDash(),
          fill: 'none',
        },
      })
    }
  }

  override onPointerMove() {
    this.updateShape(this.editor.inputs.currentPagePoint)
  }

  override onPointerUp() {
    if (!this.shapeId || !this.start) return
    this.updateShape(this.editor.inputs.currentPagePoint)
    this.editor.select(this.shapeId)
    this.editor.markHistoryStoppingPoint('geometry-shape-complete')
    this.shapeId = null
    this.start = null
  }

  override onCancel() {
    this.removeIncompleteShape()
    this.editor.setCurrentTool('select')
  }

  private updateShape(point: { x: number; y: number }) {
    if (!this.shapeId || !this.start) return

    if (this.mode === 'vector' || this.mode === 'line' || this.mode === 'dashed-line') {
      this.editor.updateShape<TLArrowShape>({
        id: this.shapeId,
        type: 'arrow',
        props: { end: { x: point.x - this.start.x, y: point.y - this.start.y } },
      })
      return
    }

    if (this.mode === 'circle') {
      const radius = Math.max(0.5, Math.hypot(point.x - this.start.x, point.y - this.start.y))
      this.editor.updateShape<TLGeoShape>({
        id: this.shapeId,
        type: 'geo',
        x: this.start.x - radius,
        y: this.start.y - radius,
        props: { w: radius * 2, h: radius * 2 },
      })
      return
    }

    this.editor.updateShape<TLGeoShape>({
      id: this.shapeId,
      type: 'geo',
      x: Math.min(this.start.x, point.x),
      y: Math.min(this.start.y, point.y),
      props: {
        w: Math.max(1, Math.abs(point.x - this.start.x)),
        h: Math.max(1, Math.abs(point.y - this.start.y)),
      },
    })
  }

  private removeIncompleteShape() {
    if (this.shapeId) this.editor.deleteShape(this.shapeId)
    this.shapeId = null
    this.start = null
  }

  private getColor() {
    return this.editor.getStyleForNextShape(DefaultColorStyle)
  }

  private getDash() {
    return this.editor.getStyleForNextShape(DefaultDashStyle)
  }

  private getSize() {
    return this.editor.getStyleForNextShape(DefaultSizeStyle)
  }
}
