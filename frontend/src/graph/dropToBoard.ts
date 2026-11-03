import { AssetRecordType, createShapeId, type Editor, type TLAsset, type TLImageShape, type TLShapeId } from 'tldraw'
import { cardPalette } from './render'
import { graphDataToProps, type GraphShape, type GraphShapeData } from './GraphShape'
import { PLOT_H, PLOT_W } from './view'

/** Thả một ảnh (data URL) vào giữa vùng đang nhìn của bảng. Ảnh là tĩnh: muốn đổi thì thả lại bản mới. */
export function dropImageToBoard(editor: Editor, src: string, mimeType: string, w: number, h: number, name: string, meta?: Record<string, any>) {
  const vp = editor.getViewportPageBounds()
  const dw = Math.min(400, vp.w * 0.6)
  const dh = (dw * h) / w
  const c = vp.center
  const assetId = AssetRecordType.createId()
  const id = createShapeId()
  editor.run(() => {
    editor.createAssets([
      { id: assetId, typeName: 'asset', type: 'image', meta: {}, props: { name, src, w, h, mimeType, isAnimated: false } } as TLAsset,
    ])
    editor.createShape({ id, type: 'image', x: c.x - dw / 2, y: c.y - dh / 2, props: { assetId, w: dw, h: dh }, meta: meta ?? {} })
  })
  editor.select(id)
  return id
}

/** Đưa dữ liệu toán học lên bảng như một shape có thể chỉnh sửa và lưu cùng tài liệu. */
export function dropGraphToBoard(editor: Editor, data: GraphShapeData) {
  const vp = editor.getViewportPageBounds()
  const w = Math.min(400, vp.w * 0.6)
  const h = (w * PLOT_H) / PLOT_W
  const id = createShapeId()
  editor.createShape<GraphShape>({
    id,
    type: 'graph',
    x: vp.center.x - w / 2,
    y: vp.center.y - h / 2,
    props: { w, h, ...graphDataToProps(data) },
  })
  editor.select(id)
  return id
}

/** Cập nhật dữ liệu của graph đang chọn; đồ thị ảnh cũ được nâng cấp tại chỗ thành shape. */
export function updateGraphOnBoard(editor: Editor, id: TLShapeId, data: GraphShapeData) {
  const shape = editor.getShape(id)
  if (!shape) return false
  if (shape.type === 'graph') {
    editor.updateShape<GraphShape>({ id, type: 'graph', props: graphDataToProps(data) })
    return true
  }
  if (shape.type !== 'image') return false

  const image = shape as TLImageShape
  const idNew = createShapeId()
  const graphMeta = image.meta.graph
  const legacyMeta = graphMeta && typeof graphMeta === 'object' ? { graph: graphMeta } : {}
  editor.run(() => {
    editor.createShape<GraphShape>({
      id: idNew,
      type: 'graph',
      x: image.x,
      y: image.y,
      rotation: image.rotation,
      props: { w: image.props.w, h: image.props.h, ...graphDataToProps({
        ...data,
        colors: data.colors.length ? data.colors : cardPalette.curves,
      }) },
      meta: legacyMeta,
    })
    editor.deleteShape(id)
    const assetId = image.props.assetId
    const stillUsed = editor.store.allRecords().some(
      (record) => {
        if (record.typeName !== 'shape' || record.id === id || record.type !== 'image') return false
        return (record as TLImageShape).props.assetId === assetId
      }
    )
    if (assetId && !stillUsed) editor.deleteAssets([assetId])
  })
  editor.select(idNew)
  return true
}
