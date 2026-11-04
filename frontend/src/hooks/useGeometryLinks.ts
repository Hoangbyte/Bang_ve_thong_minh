import { useEffect } from 'react'
import type { TLGeoShape, TLLineShape } from 'tldraw'
import { useEditorStore } from '../store/useEditorStore'
import { geometryVertexCenter, getGeometryEdge, isGeometryPreview, isGeometryVertex, setLineEndpoints } from '../geometry/PointLineTool'

/** Keep shared line endpoints attached to their vertex shapes. */
export function useGeometryLinks() {
  const editor = useEditorStore((state) => state.editor)

  useEffect(() => {
    if (!editor) return

    const stopMove = editor.sideEffects.registerAfterChangeHandler('shape', (prev, next) => {
      if (prev.type !== 'geo' || next.type !== 'geo') return
      const vertex = next as TLGeoShape
      if (vertex.meta.geometryCircle === true && vertex.props.w !== vertex.props.h) {
        const diameter = Math.max(vertex.props.w, vertex.props.h)
        const centerX = vertex.x + vertex.props.w / 2
        const centerY = vertex.y + vertex.props.h / 2
        editor.updateShape<TLGeoShape>({
          id: vertex.id,
          type: 'geo',
          x: centerX - diameter / 2,
          y: centerY - diameter / 2,
          props: { w: diameter, h: diameter },
        })
        return
      }
      if (!isGeometryVertex(vertex) || isGeometryPreview(vertex)) return
      const center = geometryVertexCenter(vertex)
      for (const shape of editor.getCurrentPageShapes()) {
        if (shape.type !== 'line') continue
        const edge = getGeometryEdge(shape)
        if (!edge || edge.preview || (edge.startVertexId !== vertex.id && edge.endVertexId !== vertex.id)) continue
        const startShape = editor.getShape<TLGeoShape>(edge.startVertexId)
        const endShape = editor.getShape<TLGeoShape>(edge.endVertexId)
        if (!startShape || startShape.type !== 'geo' || !endShape || endShape.type !== 'geo') continue
        const start = edge.startVertexId === vertex.id ? center : geometryVertexCenter(startShape)
        const end = edge.endVertexId === vertex.id ? center : geometryVertexCenter(endShape)
        setLineEndpoints(editor, shape.id, start, end)
      }
    })

    const stopDelete = editor.sideEffects.registerAfterDeleteHandler('shape', (shape) => {
      if (shape.type !== 'geo' || !isGeometryVertex(shape) || isGeometryPreview(shape)) return
      const connected = editor.getCurrentPageShapes().flatMap((record) => {
        if (record.type !== 'line') return []
        const edge = getGeometryEdge(record)
        return edge && (edge.startVertexId === shape.id || edge.endVertexId === shape.id) ? [record.id] : []
      })
      if (connected.length) editor.deleteShapes(connected)
    })

    return () => {
      stopMove()
      stopDelete()
    }
  }, [editor])
}
